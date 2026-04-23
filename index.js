import { chromium } from 'playwright';
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const NUMERO = "Numero dela (550000000000)";

// 🤖 IA
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

let ultimaProcessada = "";
let timeoutMensagem = null;

async function main() {
    const context = await chromium.launchPersistentContext('./perfil', {
        headless: false,
        viewport: null,
        args: ['--start-maximized']
    });

    const page = await context.newPage();

    await page.goto('https://web.whatsapp.com');

    console.log("📲 Aguardando login...");
    await page.waitForSelector('#pane-side', { timeout: 0 });

    console.log("✅ Logado!");

    // abre conversa da outra pessoa
    await page.goto(`https://web.whatsapp.com/send?phone=${NUMERO}`);

    await page.waitForSelector('footer [contenteditable="true"]');

    console.log("💬 Conversa pronta!");

    iniciarLoop(page);
}

function iniciarLoop(page) {
    setInterval(async () => {
        try {
            if (page.isClosed()) return;

            const resultado = await page.evaluate(() => {
                const mensagens = document.querySelectorAll('#main div[class*="message-"]');

                if (!mensagens.length) return null;

                const ultimaMsg = mensagens[mensagens.length - 1];

                const isFromMe = ultimaMsg.classList.contains('message-out');

                const spans = ultimaMsg.querySelectorAll('span');

                const textos = Array.from(spans)
                    .map(s => s.innerText)
                    .filter(t =>
                        t &&
                        t.length > 1 &&
                        !t.includes(":") &&
                        !t.includes("Digite uma mensagem")
                    );

                if (!textos.length) return null;

                return {
                    texto: textos[textos.length - 1],
                    fromMe: isFromMe
                };
            });

            if (!resultado) return;

            const { texto, fromMe } = resultado;

            console.log("🧪 Capturada:", texto, "| fromMe:", fromMe);

            if (fromMe) return;

            if (texto === ultimaProcessada) return;

            ultimaProcessada = texto;

            console.log("📩 Pessoa:", texto);

            clearTimeout(timeoutMensagem);

            timeoutMensagem = setTimeout(async () => {
                const resposta = await gerarRespostaIA(texto);

                await delayHumano();
                await enviarMensagem(page, resposta);

            }, 3000);

        } catch (err) {
            console.log("⚠️ Erro:", err.message);
        }
    }, 3000);
}

// 🤖 IA
async function gerarRespostaIA(msg) {
    for (let i = 0; i < 3; i++) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `
Você é (Nome) conversando com sua namorada (Nome dela) no WhatsApp.

Contexto:
- Seu nome é (Nome)
- O nome dela é (Nome dela)
- Vocês são (namorados casados ficantes)
- Estão juntos desde (data)
- Vocês têm intimidade, carinho e conversa natural do dia a dia

Seu jeito de responder:
- Carinhoso, leve e natural
- Não seja grudento
- Não use emojis
- Respostas curtas (estilo WhatsApp)
- Pode brincar, ser fofo ou descontraído dependendo da mensagem
- Pode chamar ela por "amor", "vida", etc (varia naturalmente)

Regras importantes:
- Nunca diga que é IA
- Nunca seja formal
- Nunca responda como assistente
- Responda como um namorado de verdade

Mensagem da (Nome dela):
"${msg}"
`
            });

            return response.text;

        } catch (err) {
            console.log("⚠️ Tentativa falhou:", err.message);
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    return "Depois te respondo melhor 😅";
}

// 📤 enviar
async function enviarMensagem(page, texto) {
    try {
        if (page.isClosed()) return;

        const input = page.locator('footer [contenteditable="true"]');

        await input.click();
        await page.keyboard.type(texto, { delay: 40 });
        await page.keyboard.press('Enter');

        console.log("🤖 Resposta:", texto);

    } catch (err) {
        console.log("Erro ao enviar:", err.message);
    }
}

// ⏱ delay humano
function delayHumano() {
    const tempo = 2000 + Math.random() * 3000;
    return new Promise(res => setTimeout(res, tempo));
}

main();