import PlaylistDetailPage from "@/views/app/PlaylistDetailPage";
import { mockPlaylists } from "@/lib/mock-data";

export function generateStaticParams() {
  return mockPlaylists.map((playlist) => ({ id: playlist.id }));
}

export default function AppPlaylistDetailRoute() {
  return <PlaylistDetailPage />;
}
