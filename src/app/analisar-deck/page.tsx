import { DeckAnalyzer } from "@/components/deck-analyzer";

export const metadata = {
  title: "Analisar deck Commander | Mana Draw",
  description:
    "Analise seu deck de Commander: bracket, curva de mana, sinergia, arquétipos e sugestões de melhoria."
};

export default function AnalisarDeckPage() {
  return <DeckAnalyzer />;
}
