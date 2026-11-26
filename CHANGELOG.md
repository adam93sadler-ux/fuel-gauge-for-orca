# Changelog

## 0.3.0

- Added a refresh interval of 1 to 1440 whole minutes for all providers, with a 15-minute default. Change it from the status bar controls or Orca plugin settings. The status bar controls also include **Refresh now**.
- During heavy testing, fixed polling missed allowances running out in time and some jobs stopped on usage limits. Shorter intervals help during heavy sessions, and longer intervals fit light use.

## 0.2.0

Detect every Orca agent, report unknown allowances explicitly and add experimental Gemini, Cursor, Kimi, ZCode, Amp and Hermes readers. Claude Agent Teams shares the Claude account reader.

## 0.1.0

Initial public release with four provider readers, status-bar refresh, local usage snapshots and the companion routing skill.
