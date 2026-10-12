export type LangPair = "en|zh-CN" | "zh-CN|en" | "auto";

export type TranslateResult = {
  text: string;
  translated: string;
  detectedLang: "en" | "zh" | "unknown";
  langpair: "en|zh-CN" | "zh-CN|en";
};

function detectLang(text: string): "en" | "zh" | "unknown" {
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[a-zA-Z]/.test(text)) return "en";
  return "unknown";
}

export async function translate(
  text: string,
  pair: LangPair = "auto",
): Promise<TranslateResult> {
  const q = text.trim();
  if (!q) throw new Error("Enter text to translate.");

  let langpair: "en|zh-CN" | "zh-CN|en";
  let detectedLang: "en" | "zh" | "unknown";

  if (pair === "auto") {
    detectedLang = detectLang(q);
    langpair = detectedLang === "zh" ? "zh-CN|en" : "en|zh-CN";
  } else {
    langpair = pair;
    detectedLang = pair.startsWith("zh") ? "zh" : "en";
  }

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${langpair}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Network error — check your connection and try again.");
  }

  if (!res.ok) {
    throw new Error(`Translation API error (${res.status}). Try again later.`);
  }

  const data = (await res.json()) as {
    responseStatus?: number;
    responseData?: { translatedText?: string };
    responseDetails?: string;
  };

  if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
    throw new Error(
      data.responseDetails || "Translation failed. Try a shorter phrase.",
    );
  }

  return {
    text: q,
    translated: data.responseData.translatedText,
    detectedLang,
    langpair,
  };
}
