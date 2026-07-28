use crate::models::TtsVoice;
use kothok_edge_tts::{EdgeTts, Engine, TtsEvent};

const MAX_CHUNK_BYTES: usize = 3_500;
const MAX_AUDIO_BYTES: usize = 50_000_000;

pub fn voices_for_language(language: &str) -> Vec<TtsVoice> {
    let locale = locale_for_language(language);
    let prefix = locale.split('-').next().unwrap_or("en");
    let voices: Vec<TtsVoice> = kothok_edge_tts::voices_for_lang(locale)
        .into_iter()
        .filter(|voice| voice.id().starts_with(&format!("{prefix}-")))
        .map(|voice| TtsVoice {
            id: voice.id().to_string(),
            label: voice.label().to_string(),
        })
        .collect();
    if voices.is_empty() {
        return fallback_voices(locale);
    }
    voices
}

pub async fn synthesize(text: &str, voice: &str, rate: i32) -> Result<Vec<u8>, String> {
    validate_request(text, voice, rate)?;
    let locale = locale_from_voice(voice)?;
    let rate = format!("{rate:+}%");
    let mut audio = Vec::new();

    for chunk in text_chunks(text, MAX_CHUNK_BYTES) {
        let events = EdgeTts
            .synthesize(chunk, voice, &rate, &locale)
            .await
            .map_err(|error| format!("Edge TTS could not generate audio: {error}"))?;
        for event in events {
            if let TtsEvent::Audio(bytes) = event {
                if audio.len().saturating_add(bytes.len()) > MAX_AUDIO_BYTES {
                    return Err("Generated audio exceeds the 50 MB limit".to_string());
                }
                audio.extend(bytes);
            }
        }
    }

    if audio.is_empty() {
        return Err("Edge TTS returned no audio".to_string());
    }
    Ok(audio)
}

fn validate_request(text: &str, voice: &str, rate: i32) -> Result<(), String> {
    if text.trim().is_empty() {
        return Err("Text is required to generate audio".to_string());
    }
    if !(-50..=100).contains(&rate) {
        return Err("Speech rate must be between -50% and +100%".to_string());
    }
    locale_from_voice(voice)?;
    if voice.len() > 100
        || !voice
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    {
        return Err("The selected Edge TTS voice is invalid".to_string());
    }
    Ok(())
}

fn locale_from_voice(voice: &str) -> Result<String, String> {
    let mut parts = voice.split('-');
    let language = parts.next().unwrap_or_default();
    let region = parts.next().unwrap_or_default();
    let name = parts.next().unwrap_or_default();
    if language.len() != 2
        || !(region.len() == 2 || region.len() == 4)
        || name.is_empty()
        || !language.bytes().all(|byte| byte.is_ascii_alphabetic())
        || !region.bytes().all(|byte| byte.is_ascii_alphabetic())
    {
        return Err("The selected Edge TTS voice is invalid".to_string());
    }
    Ok(format!("{language}-{region}"))
}

fn locale_for_language(language: &str) -> &str {
    let normalized = language.trim().to_lowercase().replace(['_', ' '], "-");
    let prefix = normalized.split('-').next().unwrap_or_default();
    match prefix {
        "english" | "inglês" => "en",
        "arabic" | "árabe" => "ar",
        "bengali" | "bengalês" => "bn",
        "chinese" | "chinês" | "mandarin" | "mandarim" => "zh",
        "french" | "français" | "francês" => "fr",
        "german" | "deutsch" | "alemão" => "de",
        "greek" | "grego" => "el",
        "hebrew" | "hebraico" => "he",
        "hindi" => "hi",
        "indonesian" | "indonésio" => "id",
        "italian" | "italiano" => "it",
        "japanese" | "japonês" => "ja",
        "korean" | "coreano" => "ko",
        "portuguese" | "português" => "pt",
        "russian" | "russo" => "ru",
        "spanish" | "español" | "espanhol" => "es",
        "thai" | "tailandês" => "th",
        "turkish" | "turco" => "tr",
        "urdu" => "ur",
        "vietnamese" | "vietnamita" => "vi",
        _ => language,
    }
}

fn fallback_voices(locale: &str) -> Vec<TtsVoice> {
    let voices: &[(&str, &str)] = match locale.split('-').next().unwrap_or("en") {
        "de" => &[
            ("de-DE-KatjaNeural", "Katja (DE)"),
            ("de-DE-ConradNeural", "Conrad (DE)"),
        ],
        "es" => &[
            ("es-ES-ElviraNeural", "Elvira (ES)"),
            ("es-ES-AlvaroNeural", "Alvaro (ES)"),
        ],
        "fr" => &[
            ("fr-FR-DeniseNeural", "Denise (FR)"),
            ("fr-FR-HenriNeural", "Henri (FR)"),
        ],
        "id" => &[
            ("id-ID-GadisNeural", "Gadis (ID)"),
            ("id-ID-ArdiNeural", "Ardi (ID)"),
        ],
        "it" => &[
            ("it-IT-ElsaNeural", "Elsa (IT)"),
            ("it-IT-DiegoNeural", "Diego (IT)"),
        ],
        "pt" => &[
            ("pt-BR-FranciscaNeural", "Francisca (BR)"),
            ("pt-BR-AntonioNeural", "Antonio (BR)"),
        ],
        "tr" => &[
            ("tr-TR-EmelNeural", "Emel (TR)"),
            ("tr-TR-AhmetNeural", "Ahmet (TR)"),
        ],
        "ur" => &[
            ("ur-PK-UzmaNeural", "Uzma (PK)"),
            ("ur-PK-AsadNeural", "Asad (PK)"),
        ],
        "vi" => &[
            ("vi-VN-HoaiMyNeural", "Hoai My (VN)"),
            ("vi-VN-NamMinhNeural", "Nam Minh (VN)"),
        ],
        _ => &[("en-US-EmmaMultilingualNeural", "Emma (US)")],
    };
    voices
        .iter()
        .map(|(id, label)| TtsVoice {
            id: (*id).to_string(),
            label: (*label).to_string(),
        })
        .collect()
}

fn text_chunks(text: &str, max_bytes: usize) -> Vec<&str> {
    let mut chunks = Vec::new();
    let mut remaining = text.trim();

    while remaining.len() > max_bytes {
        let mut end = max_bytes;
        while !remaining.is_char_boundary(end) {
            end -= 1;
        }
        let candidate = &remaining[..end];
        let preferred_end = candidate
            .char_indices()
            .rev()
            .find(|(_, character)| {
                character.is_whitespace() || matches!(character, '.' | '!' | '?' | ';' | ':')
            })
            .map(|(index, character)| index + character.len_utf8())
            .filter(|split| *split >= max_bytes / 2)
            .unwrap_or(end);
        let (chunk, rest) = remaining.split_at(preferred_end);
        if !chunk.trim().is_empty() {
            chunks.push(chunk.trim());
        }
        remaining = rest.trim_start();
    }
    if !remaining.is_empty() {
        chunks.push(remaining);
    }
    chunks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_configured_language_names() {
        assert_eq!(locale_for_language("English"), "en");
        assert_eq!(locale_for_language("Português"), "pt");
        assert_eq!(locale_for_language("German"), "de");
        assert_eq!(locale_for_language("ja-JP"), "ja-JP");
    }

    #[test]
    fn extracts_and_validates_voice_locale() {
        assert_eq!(locale_from_voice("pt-BR-FranciscaNeural").unwrap(), "pt-BR");
        assert!(locale_from_voice("../../program").is_err());
        assert!(validate_request("Olá", "pt-BR-FranciscaNeural", -51).is_err());
    }

    #[test]
    fn chunks_long_utf8_text_on_safe_boundaries() {
        let text = "Olá mundo. ".repeat(900);
        let chunks = text_chunks(&text, MAX_CHUNK_BYTES);
        assert!(chunks.len() > 1);
        assert!(chunks.iter().all(|chunk| chunk.len() <= MAX_CHUNK_BYTES));
        assert_eq!(
            chunks.join(" ").split_whitespace().collect::<Vec<_>>(),
            text.split_whitespace().collect::<Vec<_>>()
        );
    }

    #[test]
    fn exposes_at_least_one_voice_for_common_languages() {
        assert!(!voices_for_language("English").is_empty());
        assert!(voices_for_language("Português")
            .iter()
            .any(|voice| voice.id.starts_with("pt-")));
    }
}
