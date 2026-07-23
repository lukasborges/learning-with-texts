#[derive(Debug, PartialEq)]
pub struct ParsedItem {
    pub surface: String,
    pub normalized: String,
    pub is_word: bool,
}

#[derive(Debug, PartialEq)]
pub struct ParsedSentence {
    pub content: String,
    pub items: Vec<ParsedItem>,
}

#[derive(Debug, Default, PartialEq)]
pub struct ParserConfig {
    pub character_substitutions: Vec<(String, String)>,
    pub sentence_terminators: String,
    pub split_each_character: bool,
}

#[cfg(test)]
pub fn parse_text(content: &str) -> Vec<ParsedSentence> {
    parse_text_with_config(content, &ParserConfig::default())
}

pub fn parse_text_with_config(content: &str, config: &ParserConfig) -> Vec<ParsedSentence> {
    let substituted = config
        .character_substitutions
        .iter()
        .fold(content.to_string(), |value, (from, to)| {
            value.replace(from, to)
        });
    split_sentences(&substituted, config)
        .into_iter()
        .map(|content| ParsedSentence {
            items: tokenize(&content, config),
            content,
        })
        .collect()
}

fn split_sentences(content: &str, config: &ParserConfig) -> Vec<String> {
    let normalized = content.replace("\r\n", "\n").replace('\r', "\n");
    let characters: Vec<char> = normalized.chars().collect();
    let mut sentences = Vec::new();
    let mut current = String::new();
    let mut boundary_pending = false;

    for (index, character) in characters.iter().copied().enumerate() {
        if character == '\n' {
            push_sentence(&mut sentences, &mut current);
            boundary_pending = false;
            continue;
        }

        if boundary_pending && character.is_whitespace() {
            push_sentence(&mut sentences, &mut current);
            boundary_pending = false;
            continue;
        }

        current.push(character);
        if is_sentence_terminator(character, config) {
            boundary_pending = true;
        } else if boundary_pending && !is_closing_punctuation(character) {
            boundary_pending = false;
        }

        if index + 1 == characters.len() {
            push_sentence(&mut sentences, &mut current);
        }
    }

    push_sentence(&mut sentences, &mut current);
    sentences
}

fn push_sentence(sentences: &mut Vec<String>, current: &mut String) {
    let sentence = current.trim();
    if !sentence.is_empty() {
        sentences.push(sentence.to_string());
    }
    current.clear();
}

fn is_sentence_terminator(character: char, config: &ParserConfig) -> bool {
    if config.sentence_terminators.is_empty() {
        matches!(character, '.' | '!' | '?' | '。' | '！' | '？')
    } else {
        config.sentence_terminators.contains(character)
    }
}

fn is_closing_punctuation(character: char) -> bool {
    matches!(character, '"' | '\'' | '”' | '’' | ')' | ']' | '}')
}

fn tokenize(sentence: &str, config: &ParserConfig) -> Vec<ParsedItem> {
    let characters: Vec<char> = sentence.chars().collect();
    let mut items: Vec<ParsedItem> = Vec::new();
    let mut current = String::new();
    let mut current_is_word = None;

    for (index, character) in characters.iter().copied().enumerate() {
        let is_word = if config.split_each_character {
            character.is_alphanumeric() || character == '_' || is_combining_mark(character)
        } else {
            is_word_character(&characters, index)
        };
        if config.split_each_character && is_combining_mark(character) {
            if let Some(item) = items.last_mut().filter(|item| item.is_word) {
                item.surface.push(character);
                item.normalized.extend(character.to_lowercase());
                continue;
            }
        }
        if config.split_each_character && is_word {
            push_item(&mut items, &mut current, current_is_word.unwrap_or(false));
            current_is_word = None;
            items.push(ParsedItem {
                surface: character.to_string(),
                normalized: character.to_lowercase().collect(),
                is_word: true,
            });
            continue;
        }
        if current_is_word.is_some_and(|value| value != is_word) {
            push_item(&mut items, &mut current, current_is_word.unwrap_or(false));
        }
        current_is_word = Some(is_word);
        current.push(character);
    }
    push_item(&mut items, &mut current, current_is_word.unwrap_or(false));
    items
}

fn is_word_character(characters: &[char], index: usize) -> bool {
    let character = characters[index];
    if character.is_alphanumeric() || character == '_' || is_combining_mark(character) {
        return true;
    }

    matches!(character, '\'' | '’' | '-' | '‐' | '‑')
        && index > 0
        && index + 1 < characters.len()
        && characters[index - 1].is_alphanumeric()
        && characters[index + 1].is_alphanumeric()
}

fn is_combining_mark(character: char) -> bool {
    matches!(
        character as u32,
        0x0300..=0x036F
            | 0x1AB0..=0x1AFF
            | 0x1DC0..=0x1DFF
            | 0x20D0..=0x20FF
            | 0xFE20..=0xFE2F
    )
}

fn push_item(items: &mut Vec<ParsedItem>, current: &mut String, is_word: bool) {
    if current.is_empty() {
        return;
    }
    let surface = std::mem::take(current);
    let normalized = if is_word {
        surface.to_lowercase()
    } else {
        String::new()
    };
    items.push(ParsedItem {
        surface,
        normalized,
        is_word,
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_common_and_unicode_sentence_boundaries() {
        let parsed = parse_text("Hello world! \"How are you?\"\n元気ですか？ はい。 Last line");
        let sentences: Vec<&str> = parsed
            .iter()
            .map(|sentence| sentence.content.as_str())
            .collect();

        assert_eq!(
            sentences,
            [
                "Hello world!",
                "\"How are you?\"",
                "元気ですか？",
                "はい。",
                "Last line"
            ]
        );
    }

    #[test]
    fn preserves_separators_and_normalizes_unicode_terms() {
        let parsed = parse_text("L’ÉTÉ well-known.");
        let items = &parsed[0].items;

        assert_eq!(
            items,
            &[
                ParsedItem {
                    surface: "L’ÉTÉ".into(),
                    normalized: "l’été".into(),
                    is_word: true,
                },
                ParsedItem {
                    surface: " ".into(),
                    normalized: String::new(),
                    is_word: false,
                },
                ParsedItem {
                    surface: "well-known".into(),
                    normalized: "well-known".into(),
                    is_word: true,
                },
                ParsedItem {
                    surface: ".".into(),
                    normalized: String::new(),
                    is_word: false,
                }
            ]
        );
    }

    #[test]
    fn applies_language_specific_parsing_rules() {
        let config = ParserConfig {
            character_substitutions: vec![("…".into(), ".".into())],
            sentence_terminators: ".;".into(),
            split_each_character: true,
        };
        let parsed = parse_text_with_config("日本語… 次; 最後!", &config);
        let words: Vec<&str> = parsed
            .iter()
            .flat_map(|sentence| sentence.items.iter())
            .filter(|item| item.is_word)
            .map(|item| item.normalized.as_str())
            .collect();

        assert_eq!(parsed.len(), 3);
        assert_eq!(words, ["日", "本", "語", "次", "最", "後"]);
        assert_eq!(parsed[1].content, "次;");
    }
}
