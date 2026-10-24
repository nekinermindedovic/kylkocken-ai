# KylKocken AI – startprojekt

Detta är en första riktig grund med:
- mobilanpassad HTML-app
- bilduppladdning till en backend
- AI-baserad identifiering av matvaror
- AI-genererade recept utifrån varje kunds egna ingredienser och preferenser
- separata API-anrop för skanning och recept

## Starta lokalt

1. Installera Node.js (LTS) från nodejs.org.
2. Packa upp ZIP-filen.
3. Öppna terminal/kommandotolk i projektmappen.
4. Kör `npm install`.
5. Kopiera `.env.example` till `.env`.
6. Lägg din egen OpenAI API-nyckel i `.env` och kontrollera att `OPENAI_MODEL` är en modell som finns aktiverad på ditt API-konto.
7. Kör `npm start`.
8. Öppna `http://localhost:3000`.

## Viktigt om API-nyckeln

- API-nyckeln ska bara ligga på servern i `.env`, aldrig i `index.html`.
- En ChatGPT-prenumeration är inte samma sak som API-krediter. API-användning kan faktureras separat.
- Modellnamn och tillgänglighet beror på ditt API-konto. Om modellen inte är tillgänglig, ändra `OPENAI_MODEL` i `.env`.
- Testa med ofarliga matbilder först. AI kan göra misstag, särskilt med dolda varor, förpackningar och mängder.

## Innan appen öppnas för kunder

Det här är en utvecklingsstart, inte en färdig produktionsdrift. Innan riktiga kunder använder appen behövs bland annat:
- inloggning och autentisering
- databas med åtkomstregler per användare
- begränsning av API-anrop och kostnadsskydd
- säker hantering/radering av uppladdade bilder
- integritetspolicy, samtycke och lämplig dataskyddsbedömning
- HTTPS, loggning utan känsliga uppgifter och produktionshosting

I denna startversion sparas inga kundbilder eller recept permanent på servern. Frontendens ingredienser ligger bara i webbläsarens minne medan sidan är öppen. Kundinloggning och synkroniserad historik är nästa steg.
