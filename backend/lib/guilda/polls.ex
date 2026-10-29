defmodule Guilda.Polls do
  @moduledoc """
  The Polls context.

  Polls belong to either a server channel (`scope: "channel"`) or a direct
  message conversation (`scope: "dm"`). Every operation checks that the acting
  user can access the place the poll lives in.
  """

  import Ecto.Query, warn: false

  alias Guilda.Repo
  alias Guilda.ChatAccess
  alias Guilda.Accounts.User
  alias Guilda.Polls.{Comment, Option, Poll, Vote}

  @max_options 10
  @min_options 2

  @preloads [:author, options: :suggested_by, votes: [], comments: :user]

  # ---------------------------------------------------------------------------
  # Access
  # ---------------------------------------------------------------------------

  @doc "Returns true if the user can see/interact with polls in the given place."
  defdelegate can_access?(user, scope, channel_id), to: ChatAccess

  # ---------------------------------------------------------------------------
  # Queries
  # ---------------------------------------------------------------------------

  @doc "Fetches a poll (fully preloaded) the user is allowed to see."
  def get_poll_for_user(%User{} = user, poll_id) do
    with true <- valid_uuid?(poll_id),
         %Poll{} = poll <- Repo.get(Poll, poll_id) do
      if can_access?(user, poll.scope, poll.channel_id) do
        {:ok, load(poll)}
      else
        {:error, :forbidden}
      end
    else
      _ -> {:error, :not_found}
    end
  end

  @list_limit 100

  @doc """
  Polls of a server channel, newest first (max #{@list_limit}).

  Returns `{:error, :not_found}` both when the channel does not exist and when
  the user cannot see it, so the answer never reveals which channels exist.
  """
  def list_for_channel(%User{} = user, channel_id) do
    if can_access?(user, "channel", channel_id) do
      polls =
        from(p in Poll,
          where: p.scope == "channel" and p.channel_id == ^channel_id,
          order_by: [desc: p.inserted_at, desc: p.id],
          limit: ^@list_limit
        )
        |> Repo.all()
        |> Repo.preload(@preloads)

      {:ok, polls}
    else
      {:error, :not_found}
    end
  end

  defp load(%Poll{} = poll), do: Repo.preload(poll, @preloads, force: true)

  # ---------------------------------------------------------------------------
  # Mutations
  # ---------------------------------------------------------------------------

  @doc """
  Creates a poll with its initial options.

  `attrs` accepts string keys: scope, channel_id, title, options (list of
  strings), allow_suggestions, multiple_choice, allow_comments, expires_at.
  """
  def create_poll(%User{} = user, attrs) do
    scope = attrs["scope"]
    channel_id = attrs["channel_id"]
    option_texts = normalize_options(attrs["options"])

    cond do
      not can_access?(user, scope, channel_id) ->
        {:error, :forbidden}

      length(option_texts) < @min_options or length(option_texts) > @max_options ->
        {:error, :invalid_options}

      true ->
        poll_attrs = %{
          "scope" => scope,
          "channel_id" => channel_id,
          "author_id" => user.id,
          "title" => attrs["title"] || "",
          "allow_suggestions" => attrs["allow_suggestions"] == true,
          "multiple_choice" => attrs["multiple_choice"] == true,
          "allow_comments" => attrs["allow_comments"] != false,
          "expires_at" => attrs["expires_at"]
        }

        Repo.transaction(fn ->
          case %Poll{} |> Poll.changeset(poll_attrs) |> Repo.insert() do
            {:ok, poll} ->
              option_texts
              |> Enum.with_index()
              |> Enum.each(fn {text, index} ->
                %Option{}
                |> Option.changeset(%{text: text, position: index, poll_id: poll.id})
                |> Repo.insert!()
              end)

              load(poll)

            {:error, changeset} ->
              Repo.rollback(changeset)
          end
        end)
    end
  end

  defp normalize_options(options) when is_list(options) do
    options
    |> Enum.filter(&is_binary/1)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  defp normalize_options(_), do: []

  @doc "Toggles the user's vote on an option, honouring single/multiple choice."
  def toggle_vote(%User{} = user, %Poll{} = poll, option_id) do
    cond do
      not can_access?(user, poll.scope, poll.channel_id) -> {:error, :forbidden}
      not open?(poll) -> {:error, :closed}
      not valid_uuid?(option_id) -> {:error, :not_found}
      true -> do_toggle_vote(user, poll, option_id)
    end
  end

  defp do_toggle_vote(user, poll, option_id) do
    case Repo.get_by(Option, id: option_id, poll_id: poll.id) do
      nil ->
        {:error, :not_found}

      option ->
        Repo.transaction(fn ->
          case Repo.get_by(Vote, option_id: option.id, user_id: user.id) do
            nil ->
              clear_votes_unless_multiple(poll, user)
              insert_vote!(poll, option, user)

            existing ->
              Repo.delete!(existing)
          end

          load(poll)
        end)
    end
  end

  defp clear_votes_unless_multiple(%Poll{multiple_choice: true}, _user), do: :ok

  defp clear_votes_unless_multiple(poll, user) do
    Repo.delete_all(from v in Vote, where: v.poll_id == ^poll.id and v.user_id == ^user.id)
    :ok
  end

  defp insert_vote!(poll, option, user) do
    %Vote{}
    |> Vote.changeset(%{poll_id: poll.id, option_id: option.id, user_id: user.id})
    |> Repo.insert!()
  end

  @doc "Adds a community-suggested option (auto-voted by the suggester)."
  def suggest_option(%User{} = user, %Poll{} = poll, text) do
    text = if is_binary(text), do: String.trim(text), else: ""

    cond do
      not can_access?(user, poll.scope, poll.channel_id) ->
        {:error, :forbidden}

      not open?(poll) ->
        {:error, :closed}

      not poll.allow_suggestions ->
        {:error, :suggestions_disabled}

      duplicate_option?(poll, text) ->
        {:error, :duplicate}

      option_count(poll) >= @max_options ->
        {:error, :invalid_options}

      true ->
        position = option_count(poll)

        Repo.transaction(fn ->
          option =
            case %Option{}
                 |> Option.changeset(%{
                   text: text,
                   position: position,
                   poll_id: poll.id,
                   suggested_by_id: user.id
                 })
                 |> Repo.insert() do
              {:ok, option} -> option
              {:error, changeset} -> Repo.rollback(changeset)
            end

          clear_votes_unless_multiple(poll, user)
          insert_vote!(poll, option, user)
          load(poll)
        end)
    end
  end

  defp option_count(poll),
    do: Repo.aggregate(from(o in Option, where: o.poll_id == ^poll.id), :count)

  defp duplicate_option?(poll, text) do
    lowered = String.downcase(text)

    Repo.exists?(
      from o in Option, where: o.poll_id == ^poll.id and fragment("lower(?)", o.text) == ^lowered
    )
  end

  @doc "Adds a comment to a poll with comments enabled."
  def add_comment(%User{} = user, %Poll{} = poll, text) do
    cond do
      not can_access?(user, poll.scope, poll.channel_id) ->
        {:error, :forbidden}

      not poll.allow_comments ->
        {:error, :comments_disabled}

      true ->
        case %Comment{}
             |> Comment.changeset(%{text: text, poll_id: poll.id, user_id: user.id})
             |> Repo.insert() do
          {:ok, _comment} -> {:ok, load(poll)}
          {:error, changeset} -> {:error, changeset}
        end
    end
  end

  @doc "Closes or reopens a poll. Author only."
  def set_closed(%User{id: user_id}, %Poll{author_id: author_id} = poll, closed)
      when is_boolean(closed) do
    if user_id == author_id do
      {:ok, updated} = poll |> Poll.closed_changeset(closed) |> Repo.update()
      {:ok, load(updated)}
    else
      {:error, :forbidden}
    end
  end

  @doc "Deletes a poll. Author only."
  def delete_poll(%User{id: user_id}, %Poll{author_id: author_id} = poll) do
    if user_id == author_id do
      Repo.delete(poll)
    else
      {:error, :forbidden}
    end
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  @doc "True while the poll accepts votes/suggestions."
  def open?(%Poll{closed: true}), do: false
  def open?(%Poll{expires_at: nil}), do: true

  def open?(%Poll{expires_at: expires_at}),
    do: DateTime.compare(expires_at, DateTime.utc_now()) == :gt

  @doc "PubSub topic of the chat the poll lives in."
  def topic(%Poll{scope: "channel", channel_id: id}), do: "channel:#{id}"
  def topic(%Poll{scope: "dm", channel_id: id}), do: "dm:#{id}"

  defp valid_uuid?(value), do: ChatAccess.valid_uuid?(value)

  @doc "Serializes a fully preloaded poll for the API / realtime payloads."
  def serialize(%Poll{} = poll) do
    votes_by_option = Enum.group_by(poll.votes, & &1.option_id, & &1.user_id)

    %{
      id: poll.id,
      scope: poll.scope,
      channelId: poll.channel_id,
      authorId: poll.author_id,
      authorName: poll.author && poll.author.display_name,
      authorAvatar: poll.author && poll.author.avatar_url,
      title: poll.title,
      options:
        Enum.map(poll.options, fn opt ->
          %{
            id: opt.id,
            text: opt.text,
            votes: Map.get(votes_by_option, opt.id, []),
            isCommunitySuggestion: not is_nil(opt.suggested_by_id),
            suggestedBy:
              opt.suggested_by &&
                %{
                  id: opt.suggested_by.id,
                  name: opt.suggested_by.display_name,
                  avatarUrl: opt.suggested_by.avatar_url
                }
          }
        end),
      allowSuggestions: poll.allow_suggestions,
      multipleChoice: poll.multiple_choice,
      allowComments: poll.allow_comments,
      expiresAt: poll.expires_at,
      closed: poll.closed,
      comments:
        Enum.map(poll.comments, fn c ->
          %{
            id: c.id,
            pollId: c.poll_id,
            authorId: c.user_id,
            authorName: c.user && c.user.display_name,
            authorAvatar: c.user && c.user.avatar_url,
            content: c.text,
            insertedAt: c.inserted_at
          }
        end),
      insertedAt: poll.inserted_at
    }
  end
end
