import { useState } from "react";
import VoiceRecognitionPage from "./components/voice-recognition-page";
import HistoryPage from "./components/history-page";
import FormsPage from "./components/forms-page";
import Navigation from "./components/navigation";

type Page = "voice" | "history" | "forms";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("voice");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
      <main className="container mx-auto px-4 py-8">
        {currentPage === "voice" && <VoiceRecognitionPage />}
        {currentPage === "history" && <HistoryPage />}
        {currentPage === "forms" && <FormsPage />}
      </main>
    </div>
  );
}
