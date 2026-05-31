import AlbumDetailPage from "@/views/app/AlbumDetailPage";
import { mockAlbums } from "@/lib/mock-data";

export function generateStaticParams() {
  return mockAlbums.map((album) => ({ id: album.id }));
}

export default function AppAlbumDetailRoute() {
  return <AlbumDetailPage />;
}
