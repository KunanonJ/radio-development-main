import ArtistDetailPage from "@/views/app/ArtistDetailPage";
import { mockArtists } from "@/lib/mock-data";

export function generateStaticParams() {
  return mockArtists.map((artist) => ({ id: artist.id }));
}

export default function AppArtistDetailRoute() {
  return <ArtistDetailPage />;
}
