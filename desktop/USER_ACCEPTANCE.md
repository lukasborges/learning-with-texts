# Nontechnical User Acceptance Test

Use this script with at least two people who did not build the application and
are not regular contributors. Give each tester only the installer, its checksum
file, and this page. Do not coach them unless they become blocked; record every
place where assistance is needed. The retained records must cover at least one
Windows tester and one Linux tester; the Linux tester may use DEB, AppImage, or
the Arch Linux package.

Unsigned workflow artifacts are test builds only. Perform public testing with a
signed draft release once signing credentials are provisioned.

## Test Record

Record the tester identifier, operating system and version, installer type,
application version, start/end time, and whether assistance was required. Link
screenshots or screen recordings for failures, but remove personal text and
backup contents before sharing them.

## Tasks

Ask the tester to complete these tasks in order:

1. Verify the downloaded checksum using the instructions in
   [RELEASING.md](RELEASING.md), then install and launch LWT Desktop. On
   Windows, record whether the documented unknown-publisher warning and the
   steps required to continue are understandable.
2. Create a language, import or paste a short text, and open it for reading.
3. Change a term status, add its translation, complete one review, and confirm
   that the statistics screen changes.
4. Add a tag and local audio file, close the application, reopen it, and confirm
   that the text, term, tag, and audio remain available.
5. Create a backup. Add another text, restore the backup, and confirm that the
   later text disappears while the backed-up data remains.
6. Install the next draft version over the existing version. Confirm that the
   library survives and repeat one reading and review action.
7. Uninstall the application using the operating system's normal application
   manager. Record whether the process is understandable and whether the user
   expected personal library data to be retained or removed.

## Acceptance Criteria

The gate passes only when every tester completes installation, backup, upgrade,
restore, and removal without contributor intervention; no data is lost; and no
unresolved severity-high usability problem remains. Log minor findings with the
tester record and retest any corrective change before marking the migration
checkbox complete.
