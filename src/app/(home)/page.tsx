import { Footer } from './_components/footer';
import { Header } from './_components/header';
import { Viewer } from './_components/viewer';

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 px-3 py-4 text-sm text-slate-800 sm:px-6 sm:py-8">
      <Header />
      <Viewer />
      <Footer />
    </main>
  );
}
