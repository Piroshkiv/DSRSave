# Вспомогательные скрипты

Исследовательские инструменты, которыми найдены офсеты для редактора
(`../ds1-save-editor`). В сам редактор не входят. Общий приём: править
значение в памяти игры (как Cheat Engine), заставить игру сохраниться
(ESC ×2) и диффить расшифрованные слоты `.sl2`.

| Папка | Игра | Что делает |
|---|---|---|
| `ds1-appearance-sweeper/` | DSR | внешность: память ↔ сейв ↔ `.dsrchr` (DSAppearancePresetTool), `--watch` за изменениями памяти и сейва |
| `ds1-gesture-sweeper/` | DSR | флаги жестов |
| `ds3-appearance-sweeper/` | DS3 | face-блок, пресеты, `--watch-ids` / `--watch-region` |
| `ds3-gesture-sweeper/` | DS3 | флаги жестов |
| `ds3-stat-sweeper/` | DS3 | статы 1→99, производные значения |
| `parse_ds3_items.py` | DS3 | CT → `public/json/ds3_items.json` |

Зависимости у всех свиперов одинаковые: `pip install pymem pycryptodome`.
Подробности — в README каждой папки.
