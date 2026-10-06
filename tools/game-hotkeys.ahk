; Global hotkeys for Cue Deck (AutoHotkey v2).
; Spotify only receives its Ctrl+Alt shortcuts while focused, so this script
; briefly focuses Spotify, sends the shortcut, and returns to the window you
; were in. F13–F20 suit a Stream Deck or macro pad; change them to taste.

#Requires AutoHotkey v2.0
#SingleInstance Force

SendToSpotify(keys) {
    prev := WinExist("A")
    if !WinExist("ahk_exe Spotify.exe") {
        TrayTip "Spotify isn't running", "Cue Deck"
        return
    }
    WinActivate
    if !WinWaitActive("ahk_exe Spotify.exe", , 1)
        return
    Send keys
    Sleep 60
    if prev && prev != WinExist("ahk_exe Spotify.exe")
        WinActivate prev
}

F13::SendToSpotify("^!g")   ; Go
F14::SendToSpotify("^!s")   ; Stop
F15::SendToSpotify("^!d")   ; Duck / unduck
F16::SendToSpotify("^!1")   ; Cue 1 in the active event
F17::SendToSpotify("^!2")   ; Cue 2
F18::SendToSpotify("^!3")   ; Cue 3
F19::SendToSpotify("^!4")   ; Cue 4
F20::SendToSpotify("^!5")   ; Cue 5
