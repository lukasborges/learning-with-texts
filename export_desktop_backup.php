<?php

/**************************************************************
Export the legacy MySQL library as an LWT Desktop JSON backup.
This endpoint is read-only and does not modify the legacy data.
***************************************************************/

require_once( 'settings.inc.php' );
require_once( 'connect.inc.php' );
require_once( 'dbutils.inc.php' );
require_once( 'utilities.inc.php' );

function desktop_backup_rows($sql) {
	$result = do_mysqli_query($sql);
	$rows = array();
	while ($record = mysqli_fetch_assoc($result)) {
		$rows[] = $record;
	}
	mysqli_free_result($result);
	return $rows;
}

function desktop_backup_timestamp($value, $fallback) {
	$value = trim((string) $value);
	if ($value == '' || substr($value, 0, 10) == '0000-00-00') {
		return $fallback;
	}
	return $value;
}

function desktop_backup_substitutions($value, &$ignored) {
	$valid = array();
	foreach (explode('|', (string) $value) as $entry) {
		$entry = trim($entry);
		if ($entry == '') continue;
		$separator = strpos($entry, '=');
		if ($separator === false || trim(substr($entry, 0, $separator)) == '') {
			$ignored++;
			continue;
		}
		$valid[] = $entry;
	}
	return implode('|', $valid);
}

function desktop_backup_register_tag(&$tags, &$keys, $name, $comment) {
	$name = trim((string) $name);
	if ($name == '') return 0;
	$key = mb_strtolower($name, 'UTF-8');
	if (isset($keys[$key])) return $keys[$key];
	$id = count($tags) + 1;
	$keys[$key] = $id;
	$tags[] = array(
		'id' => $id,
		'name' => $name,
		'comment' => trim((string) $comment)
	);
	return $id;
}

function desktop_backup_audio_type($path) {
	$extension = mb_strtolower(pathinfo($path, PATHINFO_EXTENSION), 'UTF-8');
	$types = array(
		'mp3' => 'audio/mpeg',
		'm4a' => 'audio/mp4',
		'mp4' => 'audio/mp4',
		'ogg' => 'audio/ogg',
		'oga' => 'audio/ogg',
		'wav' => 'audio/wav',
		'webm' => 'audio/webm',
		'flac' => 'audio/flac'
	);
	return isset($types[$extension]) ? $types[$extension] : null;
}

function desktop_backup_local_audio($uri, $text_id, &$media_bytes, &$external, &$unsupported) {
	$uri = trim((string) $uri);
	if ($uri == '') return null;
	$scheme = parse_url($uri, PHP_URL_SCHEME);
	if ($scheme !== null && $scheme !== '') {
		$external++;
		return null;
	}
	$path = parse_url($uri, PHP_URL_PATH);
	if (! is_string($path) || $path == '') {
		$unsupported++;
		return null;
	}
	$path = rawurldecode($path);
	$candidate = __DIR__ . DIRECTORY_SEPARATOR . ltrim($path, '/\\');
	$root = realpath(__DIR__);
	$resolved = realpath($candidate);
	if ($root === false || $resolved === false || ! is_file($resolved) || strpos($resolved, $root . DIRECTORY_SEPARATOR) !== 0) {
		$unsupported++;
		return null;
	}
	$type = desktop_backup_audio_type($resolved);
	$size = filesize($resolved);
	if ($type === null || $size === false || $size < 1 || $size > 50000000 || $media_bytes + $size > 100000000) {
		$unsupported++;
		return null;
	}
	$content = file_get_contents($resolved);
	if ($content === false) {
		$unsupported++;
		return null;
	}
	$file_name = basename($resolved);
	if ($file_name == '' || mb_strlen($file_name, 'UTF-8') > 255) {
		$unsupported++;
		return null;
	}
	$media_bytes += $size;
	return array(
		'textId' => $text_id,
		'fileName' => $file_name,
		'mediaType' => $type,
		'dataBase64' => base64_encode($content)
	);
}

$exported_at = gmdate('Y-m-d H:i:s');
$warnings = array();
$languages = array();
$language_ids = array();
$texts = array();
$text_ids = array();
$media = array();
$media_bytes = 0;
$external_media = 0;
$unsupported_media = 0;
$active_text_ids = array();
$archived_text_ids = array();
$terms = array();
$term_ids = array();
$tags = array();
$tag_keys = array();
$legacy_term_tag_ids = array();
$legacy_text_tag_ids = array();
$term_tags = array();
$text_tags = array();
$expressions = array();
$skipped_compound_occurrences = 0;
$long_compound_terms = 0;
$normalized_statuses = 0;
$orphan_texts = 0;
$orphan_terms = 0;
$ignored_substitutions = 0;
$invalid_text_sizes = 0;

$records = desktop_backup_rows('select * from ' . $tbpref . 'languages order by LgID');
foreach ($records as $record) {
	$language_ids[(int) $record['LgID']] = true;
	$text_size = (int) $record['LgTextSize'];
	if ($text_size < 1) {
		$text_size = 100;
		$invalid_text_sizes++;
	}
	$languages[] = array(
		'id' => (int) $record['LgID'],
		'name' => (string) $record['LgName'],
		'dictionaryUri1' => (string) $record['LgDict1URI'],
		'dictionaryUri2' => isset($record['LgDict2URI']) ? $record['LgDict2URI'] : null,
		'googleTranslateUri' => isset($record['LgGoogleTranslateURI']) ? $record['LgGoogleTranslateURI'] : null,
		'exportTemplate' => isset($record['LgExportTemplate']) ? $record['LgExportTemplate'] : null,
		'textSize' => $text_size,
		'characterSubstitutions' => desktop_backup_substitutions($record['LgCharacterSubstitutions'], $ignored_substitutions),
		'regexpSplitSentences' => (string) $record['LgRegexpSplitSentences'],
		'exceptionsSplitSentences' => (string) $record['LgExceptionsSplitSentences'],
		'regexpWordCharacters' => (string) $record['LgRegexpWordCharacters'],
		'removeSpaces' => ((int) $record['LgRemoveSpaces']) != 0,
		'splitEachCharacter' => ((int) $record['LgSplitEachChar']) != 0,
		'rightToLeft' => ((int) $record['LgRightToLeft']) != 0
	);
}

$records = desktop_backup_rows('select * from ' . $tbpref . 'texts order by TxID');
foreach ($records as $record) {
	if (! isset($language_ids[(int) $record['TxLgID']])) {
		$orphan_texts++;
		continue;
	}
	$texts[] = array(
		'id' => (int) $record['TxID'],
		'languageId' => (int) $record['TxLgID'],
		'title' => (string) $record['TxTitle'],
		'content' => (string) $record['TxText'],
		'annotatedContent' => (string) $record['TxAnnotatedText'],
		'audioUri' => isset($record['TxAudioURI']) ? $record['TxAudioURI'] : null,
		'sourceUri' => isset($record['TxSourceURI']) ? $record['TxSourceURI'] : null,
		'lastOpenedAt' => null,
		'createdAt' => $exported_at,
		'updatedAt' => $exported_at,
		'archived' => false
	);
	$text_ids[(int) $record['TxID']] = true;
	$active_text_ids[(int) $record['TxID']] = (int) $record['TxID'];
	$audio = desktop_backup_local_audio($record['TxAudioURI'], (int) $record['TxID'], $media_bytes, $external_media, $unsupported_media);
	if ($audio !== null) $media[] = $audio;
}

$next_text_id = empty($text_ids) ? 1 : max(array_keys($text_ids)) + 1;
$records = desktop_backup_rows('select * from ' . $tbpref . 'archivedtexts order by AtID');
foreach ($records as $record) {
	if (! isset($language_ids[(int) $record['AtLgID']])) {
		$orphan_texts++;
		continue;
	}
	$desktop_text_id = $next_text_id++;
	$texts[] = array(
		'id' => $desktop_text_id,
		'languageId' => (int) $record['AtLgID'],
		'title' => (string) $record['AtTitle'],
		'content' => (string) $record['AtText'],
		'annotatedContent' => (string) $record['AtAnnotatedText'],
		'audioUri' => isset($record['AtAudioURI']) ? $record['AtAudioURI'] : null,
		'sourceUri' => isset($record['AtSourceURI']) ? $record['AtSourceURI'] : null,
		'lastOpenedAt' => null,
		'createdAt' => $exported_at,
		'updatedAt' => $exported_at,
		'archived' => true
	);
	$text_ids[$desktop_text_id] = true;
	$archived_text_ids[(int) $record['AtID']] = $desktop_text_id;
	$audio = desktop_backup_local_audio($record['AtAudioURI'], $desktop_text_id, $media_bytes, $external_media, $unsupported_media);
	if ($audio !== null) $media[] = $audio;
}

$records = desktop_backup_rows(
	'select w.*, (select max(TiWordCount) from ' . $tbpref . 'textitems ' .
	'where TiLgID = w.WoLgID and TiTextLC = w.WoTextLC and TiIsNotWord = 0) as DesktopWordCount ' .
	'from ' . $tbpref . 'words w order by w.WoID'
);
foreach ($records as $record) {
	if (! isset($language_ids[(int) $record['WoLgID']])) {
		$orphan_terms++;
		continue;
	}
	$parts = preg_split('/\s+/u', trim((string) $record['WoText']), -1, PREG_SPLIT_NO_EMPTY);
	$word_count = (int) $record['DesktopWordCount'];
	if ($word_count < 1) $word_count = is_array($parts) ? count($parts) : 1;
	if ($word_count < 1) $word_count = 1;
	if ($word_count > 9) {
		$word_count = 9;
		$long_compound_terms++;
	}
	$status = (int) $record['WoStatus'];
	if (! in_array($status, array(1, 2, 3, 4, 5, 98, 99), true)) {
		$status = 1;
		$normalized_statuses++;
	}
	$created_at = desktop_backup_timestamp($record['WoCreated'], $exported_at);
	$updated_at = desktop_backup_timestamp($record['WoStatusChanged'], $created_at);
	$terms[] = array(
		'id' => (int) $record['WoID'],
		'languageId' => (int) $record['WoLgID'],
		'displayText' => (string) $record['WoText'],
		'normalized' => (string) $record['WoTextLC'],
		'status' => $status,
		'createdAt' => $created_at,
		'updatedAt' => $updated_at,
		'translation' => (string) $record['WoTranslation'],
		'romanization' => isset($record['WoRomanization']) ? $record['WoRomanization'] : null,
		'wordCount' => $word_count,
		'lastReviewedAt' => $updated_at,
		'nextReviewAt' => null,
		'reviewCount' => 0,
		'correctCount' => 0
	);
	$term_ids[(int) $record['WoID']] = true;
}

$records = desktop_backup_rows(
	'select ti.TiTxID, ti.TiWordCount, w.WoID, s.SeOrder, ' .
	'(select count(*) from ' . $tbpref . 'textitems wi ' .
	'where wi.TiSeID = ti.TiSeID and wi.TiWordCount = 1 and wi.TiIsNotWord = 0 ' .
	'and wi.TiOrder <= ti.TiOrder) as DesktopStartWord ' .
	'from ' . $tbpref . 'textitems ti ' .
	'inner join ' . $tbpref . 'words w on w.WoLgID = ti.TiLgID and w.WoTextLC = ti.TiTextLC ' .
	'inner join ' . $tbpref . 'sentences s on s.SeID = ti.TiSeID and s.SeTxID = ti.TiTxID ' .
	'where ti.TiWordCount between 2 and 9 and ti.TiIsNotWord = 0 ' .
	'order by ti.TiTxID, s.SeOrder, ti.TiOrder, ti.TiWordCount'
);
foreach ($records as $record) {
	$legacy_text_id = (int) $record['TiTxID'];
	$text_id = isset($active_text_ids[$legacy_text_id]) ? $active_text_ids[$legacy_text_id] : 0;
	$term_id = (int) $record['WoID'];
	$sentence_position = (int) $record['SeOrder'];
	$start_word = (int) $record['DesktopStartWord'];
	if (! isset($text_ids[$text_id]) || ! isset($term_ids[$term_id]) || $sentence_position < 1 || $start_word < 1) {
		$skipped_compound_occurrences++;
		continue;
	}
	$expressions[] = array(
		'id' => count($expressions) + 1,
		'termId' => $term_id,
		'textId' => $text_id,
		'sentencePosition' => $sentence_position,
		'startWord' => $start_word
	);
}

$records = desktop_backup_rows('select * from ' . $tbpref . 'tags order by TgID');
foreach ($records as $record) {
	$legacy_term_tag_ids[(int) $record['TgID']] = desktop_backup_register_tag(
		$tags,
		$tag_keys,
		$record['TgText'],
		$record['TgComment']
	);
}
$records = desktop_backup_rows('select * from ' . $tbpref . 'tags2 order by T2ID');
foreach ($records as $record) {
	$legacy_text_tag_ids[(int) $record['T2ID']] = desktop_backup_register_tag(
		$tags,
		$tag_keys,
		$record['T2Text'],
		$record['T2Comment']
	);
}

$skipped_tag_assignments = 0;
$records = desktop_backup_rows('select * from ' . $tbpref . 'wordtags order by WtWoID, WtTgID');
foreach ($records as $record) {
	$term_id = (int) $record['WtWoID'];
	$legacy_tag_id = (int) $record['WtTgID'];
	$tag_id = isset($legacy_term_tag_ids[$legacy_tag_id]) ? $legacy_term_tag_ids[$legacy_tag_id] : 0;
	if (! isset($term_ids[$term_id]) || $tag_id < 1) {
		$skipped_tag_assignments++;
		continue;
	}
	$term_tags[] = array('termId' => $term_id, 'tagId' => $tag_id);
}
$records = desktop_backup_rows('select * from ' . $tbpref . 'texttags order by TtTxID, TtT2ID');
foreach ($records as $record) {
	$legacy_text_id = (int) $record['TtTxID'];
	$text_id = isset($active_text_ids[$legacy_text_id]) ? $active_text_ids[$legacy_text_id] : 0;
	$legacy_tag_id = (int) $record['TtT2ID'];
	$tag_id = isset($legacy_text_tag_ids[$legacy_tag_id]) ? $legacy_text_tag_ids[$legacy_tag_id] : 0;
	if (! isset($text_ids[$text_id]) || $tag_id < 1) {
		$skipped_tag_assignments++;
		continue;
	}
	$text_tags[] = array('textId' => $text_id, 'tagId' => $tag_id);
}
$records = desktop_backup_rows('select * from ' . $tbpref . 'archtexttags order by AgAtID, AgT2ID');
foreach ($records as $record) {
	$legacy_text_id = (int) $record['AgAtID'];
	$text_id = isset($archived_text_ids[$legacy_text_id]) ? $archived_text_ids[$legacy_text_id] : 0;
	$legacy_tag_id = (int) $record['AgT2ID'];
	$tag_id = isset($legacy_text_tag_ids[$legacy_tag_id]) ? $legacy_text_tag_ids[$legacy_tag_id] : 0;
	if (! isset($text_ids[$text_id]) || $tag_id < 1) {
		$skipped_tag_assignments++;
		continue;
	}
	$text_tags[] = array('textId' => $text_id, 'tagId' => $tag_id);
}
if ($skipped_tag_assignments > 0) {
	$warnings[] = $skipped_tag_assignments . ' orphaned tag assignment(s) were skipped.';
}
if ($skipped_compound_occurrences > 0) {
	$warnings[] = $skipped_compound_occurrences . ' compound expression occurrence(s) could not be located in an active legacy text and were skipped.';
}
if ($external_media > 0) {
	$warnings[] = $external_media . ' remote audio reference(s) were retained as links and were not embedded.';
}
if ($unsupported_media > 0) {
	$warnings[] = $unsupported_media . ' local audio file(s) were missing, outside the LWT directory, too large, or used an unsupported format and were not embedded.';
}
if ($long_compound_terms > 0) {
	$warnings[] = $long_compound_terms . ' compound term(s) exceeded the desktop nine-term limit; their word count was capped at nine.';
}
if ($normalized_statuses > 0) {
	$warnings[] = $normalized_statuses . ' term status value(s) were unsupported and changed to Learning (1).';
}
if ($orphan_texts > 0) {
	$warnings[] = $orphan_texts . ' text(s) referenced a missing language and were skipped.';
}
if ($orphan_terms > 0) {
	$warnings[] = $orphan_terms . ' term(s) referenced a missing language and were skipped.';
}
if ($ignored_substitutions > 0) {
	$warnings[] = $ignored_substitutions . ' malformed character substitution(s) were ignored, matching the legacy parser behavior.';
}
if ($invalid_text_sizes > 0) {
	$warnings[] = $invalid_text_sizes . ' invalid language text size value(s) were reset to 100.';
}
if (count($languages) > 0) {
	$warnings[] = 'Legacy word-character regular expressions and sentence exceptions were retained for reference; the desktop parser uses Unicode word rules and the configured sentence-ending characters.';
}
if (count($terms) > 0) {
	$warnings[] = 'The legacy database has no review-event history. Imported learning terms will be due for review immediately.';
}

$backup = array(
	'format' => 'lwt-desktop-backup',
	'version' => 1,
	'exportedAt' => $exported_at,
	'source' => 'lwt-legacy-php',
	'warnings' => $warnings,
	'languages' => $languages,
	'texts' => $texts,
	'media' => $media,
	'terms' => $terms,
	'tags' => $tags,
	'termTags' => $term_tags,
	'textTags' => $text_tags,
	'expressions' => $expressions,
	'reviews' => array()
);

try {
	$json = json_encode(
		$backup,
		JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR
	);
} catch (Throwable $error) {
	http_response_code(500);
	header('Content-Type: text/plain; charset=UTF-8');
	echo 'Unable to encode the desktop migration backup: ' . $error->getMessage();
	exit();
}

$prefix = ($tbpref == '') ? '' : preg_replace('/[^A-Za-z0-9_-]/', '-', substr($tbpref, 0, -1)) . '-';
$filename = 'lwt-desktop-migration-' . $prefix . date('Y-m-d-H-i-s') . '.json';
header('Content-Type: application/json; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
echo $json;
exit();
