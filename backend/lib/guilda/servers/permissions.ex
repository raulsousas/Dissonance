defmodule Guilda.Servers.Permissions do
  @moduledoc """
  Permission bitmask constants for server roles.

  Usage:
    alias Guilda.Servers.Permissions
    Permissions.has_permission?(role.permissions, Permissions.manage_channels())
  """

  import Bitwise

  @manage_server   0b0000000001
  @manage_channels 0b0000000010
  @manage_invites  0b0000000100
  @manage_members  0b0000001000
  @delete_messages 0b0000010000
  @send_messages   0b0000100000
  @attach_files    0b0001000000
  @connect_voice   0b0010000000
  @speak_voice     0b0100000000
  @video           0b1000000000

  # All permissions combined (bitwise OR of all flags)
  @all_permissions @manage_server ||| @manage_channels ||| @manage_invites |||
                   @manage_members ||| @delete_messages ||| @send_messages |||
                   @attach_files ||| @connect_voice ||| @speak_voice ||| @video

  # Default member permissions
  @default_permissions @send_messages ||| @attach_files ||| @connect_voice ||| @speak_voice

  def manage_server,       do: @manage_server
  def manage_channels,     do: @manage_channels
  def manage_invites,      do: @manage_invites
  def manage_members,      do: @manage_members
  def delete_messages,     do: @delete_messages
  def send_messages,       do: @send_messages
  def attach_files,        do: @attach_files
  def connect_voice,       do: @connect_voice
  def speak_voice,         do: @speak_voice
  def video,               do: @video
  def all_permissions,     do: @all_permissions
  def default_permissions, do: @default_permissions

  @doc "Returns true if the bitmask grants the given permission bit."
  def has_permission?(bitmask, permission) when is_integer(bitmask) and is_integer(permission) do
    band(bitmask, permission) == permission
  end
end
