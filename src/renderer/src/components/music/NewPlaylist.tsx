import { useMusic } from '../../state/music'
import PlaylistName from './PlaylistName'

// Making a list, all the way through: it is named, it is written down, and
// whoever asked is handed it the moment it lands, so the panel can open on it
// and a track can be filed into it in the same breath. Nothing is made by
// wandering off and nothing typed is lost by it either.
export default function NewPlaylist({
  open,
  onClose,
  onMade
}: {
  open: boolean
  onClose: () => void
  onMade: (playlistId: string) => void
}) {
  return (
    <PlaylistName
      open={open}
      title="New playlist"
      action="Create"
      onClose={onClose}
      onSubmit={async name => {
        const playlistId = await useMusic.getState().makePlaylist(name)
        if (playlistId) onMade(playlistId)
        return playlistId !== null
      }}
    />
  )
}
