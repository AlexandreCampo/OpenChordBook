# Using OpenChordBook

## Reading charts

On mobile and desktop, opening a tune fills the viewport with the sheet. Only
Library and Chart settings remain at the top, beside a compact tune heading.
The compact bottom bar keeps previous/next tune, chart size and transposition
within reach while you read or scroll, without covering the chords. Tap **Fit**
to restore automatic sizing or the transpose number to return to the saved key.
The Android app also
hides system bars while reading; swipe from an edge to reveal them temporarily.
Opening the library or a dialog restores the system bars.

Each tune opens at **18 pt**, shrinking only when needed to fit the available
width and height, down to **12 pt**. Short tunes stay at the default size;
charts that still do not fit at the minimum can scroll. Chart settings lets you
change both sizes with the −/+ buttons or number fields. These preferences are
saved on this device, and changes apply immediately without blurring the chart.
The default is always at least the minimum; changing one past the other adjusts
both. The live A−/A+ buttons override the size for the current tune. Opening
another tune restores automatic sizing; rotation refits unless you chose a
manual size. Older global zoom adjustments no longer carry over between tunes.

Time signatures sit between the opening barline and the first chord, with space
reserved only on rows that need them. Imported and authored meters use the same
aligned music-font numerals. Auto-fit includes this space; a dense row that cannot fit at the
minimum size scrolls horizontally without squeezing its chords together.

Chart settings also contains day/night mode and **Export to file**.
The reading sequence stays tied to the folder or search results from
which the tune was opened. Browsing another folder does not change that sequence.
Library, Discover and Create use the same tabbed workspace on every screen.
Opening a tune closes that workspace; Library brings it back. Desktop gives the
sections more width and keeps the editor’s writing and preview panes side by side.

## Organizing your library

The current path and **Change** button stay visible while the denser tune list
scrolls. Library, Discover and Create are the three main tabs. Import playlist
and Paste link stay at the bottom of Discover while its collections scroll.

- **Change folders:** Change opens a separate chooser. Browse folder rows and
  their breadcrumb path, then Open folder. Choose Library in the path and Open
  library to return to all tunes.
  Closing the chooser leaves the current library location unchanged.
- **Direct membership:** each folder lists only its own tunes. The chooser
  shows subfolders with their tune and subfolder counts.
- **Create, rename, move:** New folder in the chooser lets you choose its parent.
  Use the ellipsis beside a folder or Edit this folder to rename, move or delete
  it. Descendants cannot be selected as parents, and storage rejects cycles
  and duplicate names under the same parent.
- **Organize a tune:** use its folder button. **Move** replaces its current folder
  assignments. **Add to another folder** retains them. Browse nested folders
  and use the path to move back up before confirming the destination. Existing
  multi-folder memberships are preserved until you explicitly change them.
- **Organize several:** Select, choose tunes (or Select all shown), then Move or
  Add to folder. Remove from folder affects only the current folder and keeps
  the tunes in the library. An empty folder also offers Add tunes from library.
- **Delete a folder:** the editor explains that tunes are kept and subfolders
  move up one level. Deleting tunes is a separate, explicitly confirmed action.
- **Import into a folder:** file, pasted-link, dropped-file, and Android Discover
  imports all show the tune count, playlist name, and destination before saving.
  The current folder is preselected. Browse to another folder, select Library
  to save without a folder, or create a new folder right there. Cancelling adds
  no tunes. After import, the destination opens so you can inspect the result
  and choose a tune. Songs and their initial
  folder membership are committed in a single transaction.
- **Group versions** combines same-name tunes in the current view, with an
  expandable row for choosing a version. It does not merge or delete records.

The current folder, theme and default/minimum chart sizes are remembered. Existing
songs and folder hierarchies need no database migration.

## Writing a chart

Open the **Create** tab, enter a title, key and default time signature, and type chords:

```text
[AABA]
|: Dm7 | G7 :| Cmaj7 | %
[Bridge]
[3/4] Fmaj7 | Bb7 | [7/8] Em7 A7 | [4/4] Dm7 G7
```

Use `|` or a new line between bars, and spaces for up to four chords within
a bar. Two chords split a bar evenly. The chart wraps every four bars;
section names such as `[AABA]`, `[Intro]` or `[Bridge]` start new rows.
`%` repeats the previous bar; `|: Dm7 | G7 :|` draws repeat barlines around
one or more bars. `[3/4]` changes the meter at that bar and carries forward
until another change. Time signatures use two number fields, both for the chart
and for bar changes. Type numbers or use the arrow controls; each accepts
whole numbers from 1 to 99, including meters such as `11/16` and `12/8`.
The **Sections, meter changes & repeats** controls insert these at the caret;
Repeat selected bars wraps whole bars (or the current bar with no selection).
Common spellings such as `Dm7`, `D-7`, `Cmaj7`, `CΔ7`, `Bø7`, `G7b9`,
`Cadd9` and slash chords work. Chord notation help is built into the editor.

Desktop shows a live preview alongside the entry field; on a phone, switch
between **Write** and **Preview**. **Save chart** lets you select or create
a destination folder. Cancelling that choice keeps your text in the editor.
Use the pencil beside a chart you created to edit it; saving updates that
tune without changing its folder memberships. The editor currently creates
and edits your own charts; imported iRealPro charts remain readable as before.
Switching tabs or going back keeps the draft in memory. **Discard** asks before
removing unsaved changes; leaving the webpage also warns about an unsaved draft.

## Keyboard navigation

`/` opens tune search, `←` / `→` switch tunes, `+` / `−` transpose,
`[` / `]` resize, `0` fits, and `F` toggles desktop stage view. Chart shortcuts
stay inactive while editing fields, browsing the library, or using dialogs.
Android Back dismisses the topmost dialog or library before leaving the app.
In the chord editor, `Ctrl+S` / `⌘S` saves the chart.


## Importing charts

Open Discover and choose **Import playlist** for an iReal Pro HTML export,
or **Paste link** for an `irealb://` playlist URI. Drag-and-drop also works
on desktop. Choose a folder before confirming the import.

Tunes are not packaged with the app. They are downloaded by the user through
Discover or imported from a playlist file.

## Exporting tunes

Use **Export to file** in one of three places:

- **Library footer:** export the current folder, including all its subfolders.
  In All tunes, this exports your whole library. Search does not limit a folder export.
- **Select:** choose individual tunes, then Export to file. Only the selected
  tunes are included, even if a search hides some of them.
- **Chart settings:** export the current chart in its saved key.

Review the tune count, then choose **Export to file**. Android opens its Save as
window; the web app downloads the file through your browser.

The result is an iReal Pro HTML playlist. To restore it in OpenChordBook, open
Discover → Import playlist and choose a destination folder. Charts written in
OpenChordBook stay editable, with their exact section names, meters and repeats.
Folder hierarchy and app preferences are not part of a playlist file.

In iReal Pro, custom section names and meters outside its supported set appear
as chart text. Its own supported time signatures use the native meter symbols.
Export files contain up to 2,000 tunes; split larger libraries into selections.

## Installation and storage

On Android, install a signed APK or add the HTTPS web app to your home screen
using your browser's install menu. On iOS, use Safari's Add to Home Screen.
The first web visit caches the application; the APK already contains its files.
Both keep charts and folders in local storage.

Export your tunes to keep a copy. Uninstalling the APK or clearing browser/app
storage deletes the local library. See [Privacy](../PRIVACY.md).

## Current limits

- There is no audio playback.
- Imported charts can be read and transposed; the editor modifies charts
  authored in openchordbook.
- Native Android and the web browser have separate libraries. There is no sync.
- Web Share Target imports and pinch-to-zoom are not implemented. Use the
  file picker/pasted link and the chart-size controls.
- The regression suite runs on Chromium and an Android emulator. Other
  browser and device combinations may behave differently.
