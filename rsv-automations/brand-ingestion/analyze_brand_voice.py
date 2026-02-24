"""
analyze_brand_voice.py
Reads all_transcripts.txt, sends to Claude API for brand voice analysis,
and saves the result as brand-voice-analysis.md
"""

import os
import sys
import anthropic

TRANSCRIPTS_FILE = os.path.join(os.path.dirname(__file__), "transcripts", "all_transcripts.txt")
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "brand-voice-analysis.md")

PROMPT = """Tu vas analyser les transcriptions YouTube ci-dessous de Brigitte Pogonat, coach de vie holistique québécoise (marque : Retrouver Sa Voie).

Ton objectif est de produire un guide de voix de marque complet et détaillé, structuré en Markdown, qui permettrait à quelqu'un d'écrire des courriels, du contenu web et des publications sociales qui sonnent EXACTEMENT comme elle.

Analyse les transcriptions selon ces 6 axes :

1. **Mots, expressions et formulations fréquents** — Quels mots reviennent constamment ? Quelles expressions sont distinctement les siennes ? Quels tics de langage ou formulations québécoises ?

2. **Concepts philosophiques fondamentaux** — Quelles sont ses idées centrales ? Comment les explique-t-elle ? Quelles métaphores utilise-t-elle pour les rendre accessibles ?

3. **Structure et rythme de ses phrases** — Comment ouvre-t-elle une idée ? Comment la développe-t-elle ? Comment la conclut-elle ? Quel est son rythme (court/long, questions rhétoriques, silences écrits) ?

4. **Thèmes récurrents** — Quels grands thèmes traversent ses vidéos ? Lesquels reviennent le plus souvent ?

5. **Histoires et métaphores récurrentes** — Y a-t-il des anecdotes, images ou métaphores qu'elle réutilise régulièrement ?

6. **Comment elle parle À son audience** — Quel niveau de connaissance assume-t-elle chez son audience ? Comment les interpelle-t-elle ? Quel ton utilise-t-elle (tu/vous, proche/distant, etc.) ?

---

Produis le résultat sous forme d'un guide de voix de marque complet en Markdown, avec des sections claires, des exemples tirés directement des transcriptions, et des directives concrètes pour écrire comme elle.

---

TRANSCRIPTIONS :

"""

def main():
    if not os.path.exists(TRANSCRIPTS_FILE):
        print(f"Error: transcripts file not found at {TRANSCRIPTS_FILE}")
        sys.exit(1)

    print("Reading transcripts...")
    with open(TRANSCRIPTS_FILE, "r", encoding="utf-8") as f:
        transcripts = f.read()

    print(f"Loaded {len(transcripts):,} characters of transcript data.")
    print("Sending to Claude for analysis (this may take a minute)...")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY environment variable not set.")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=8192,
        messages=[
            {
                "role": "user",
                "content": PROMPT + transcripts
            }
        ]
    )

    analysis = message.content[0].text

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(analysis)

    print(f"\nDone! Brand voice analysis saved to: {OUTPUT_FILE}")
    print(f"Tokens used — input: {message.usage.input_tokens:,} | output: {message.usage.output_tokens:,}")

if __name__ == "__main__":
    main()
