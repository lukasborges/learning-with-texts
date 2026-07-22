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

function desktop_backup_count($table) {
	global $tbpref;
	return (int) get_first_value('select count(*) as value from ' . $tbpref . $table);
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

$exported_at = gmdate('Y-m-d H:i:s');
$warnings = array();
$languages = array();
$language_ids = array();
$texts = array();
$terms = array();
$compound_terms = 0;
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
		'updatedAt' => $exported_at
	);
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
	if ($word_count > 1) $compound_terms++;
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
}

$archived_texts = desktop_backup_count('archivedtexts');
$term_tags = desktop_backup_count('wordtags');
$text_tags = desktop_backup_count('texttags');
if ($archived_texts > 0) {
	$warnings[] = $archived_texts . ' archived text(s) were not exported because the desktop archive is not implemented yet.';
}
if (($term_tags + $text_tags) > 0) {
	$warnings[] = ($term_tags + $text_tags) . ' tag assignment(s) were not exported because desktop tags are not implemented yet.';
}
if ($compound_terms > 0) {
	$warnings[] = $compound_terms . ' compound term(s) were preserved, but their legacy text positions must be recreated in the desktop reader.';
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
	'terms' => $terms,
	'expressions' => array(),
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
