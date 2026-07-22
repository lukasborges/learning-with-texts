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

pub fn parse_text(content: &str) -> Vec<ParsedSentence> {
    split_sentences(content)
        .into_iter()
        .map(|content| ParsedSentence {
            items: tokenize(&content),
            content,
        })
        .collect()
}

fn split_sentences(content: &str) -> Vec<String> {
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
        if is_sentence_terminator(character) {
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

fn is_sentence_terminator(character: char) -> bool {
    matches!(character, '.' | '!' | '?' | '。' | '！' | '？')
}

fn is_closing_punctuation(character: char) -> bool {
    matches!(character, '"' | '\'' | '”' | '’' | ')' | ']' | '}')
}

fn tokenize(sentence: &str) -> Vec<ParsedItem> {
    let characters: Vec<char> = sentence.chars().collect();
    let mut items = Vec::new();
    let mut current = String::new();
    let mut current_is_word = None;

    for (index, character) in characters.iter().copied().enumerate() {
        let is_word = is_word_character(&characters, index);
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
}
