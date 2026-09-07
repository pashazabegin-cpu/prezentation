#!/usr/bin/env python3
"""Проверка целостности презентации перед коммитом.

Ловит тот класс ошибок, из-за которых страница ломалась молча: правка съедает
кусок css или js, разметка остаётся, а стилей и функций больше нет.
Запуск: python3 check.py
"""
import os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
css  = open(os.path.join(ROOT, 'deck.css'),   encoding='utf-8').read()
js   = open(os.path.join(ROOT, 'deck.js'),    encoding='utf-8').read()

errors = []

# 1. Ключевые селекторы: разметка без стилей выглядит рабочей, но эффекта нет
REQUIRED_CSS = [
    '--u:', '.slide', '.stage', '.tile', '.tile__in',
    '.tile.is-hot',
    'html.js .tile', 'html.js .rv', '.tile.is-vis', '.rv.is-vis',
    '.marquee', '.marquee__track', '.mark', '.plate',
    '.t--16-26', '.t--16-40', '.t--12-23', '.t--12-44', '.t--16-16',
    '.hud', '.t--big', '.slide--intro', '.pin',
    '.depth', '.cut .w', '.cut .m', '.cut.is-vis', '.cut.is-out',
    '.cursor-ink', '.cursor-ui', '.cursor-ink__dot', '.cursor-ui__accent',
    'html.has-cursor', 'html.c-awake', 'html.c-awake.c-view',
]
for sel in REQUIRED_CSS:
    if sel not in css:
        errors.append('deck.css: пропал селектор %s' % sel)

# 2. Каждая вызванная функция должна быть объявлена
called = set(re.findall(r'^\s{2}(init\w+)\(\);', js, re.M))
declared = set(re.findall(r'function\s+(init\w+)\s*\(', js))
for name in sorted(called - declared):
    errors.append('deck.js: %s() вызывается, но не объявлена' % name)
if not called:
    errors.append('deck.js: не найдено ни одного init-вызова — файл обрезан?')

# 3. Баланс скобок — грубая проверка, что файл не обрублен посередине
for name, src in (('deck.js', js), ('deck.css', css)):
    if src.count('{') != src.count('}'):
        errors.append('%s: скобки не сходятся ({=%d, }=%d)'
                      % (name, src.count('{'), src.count('}')))

# 4. Разметка: обязательные узлы
REQUIRED_HTML = ['data-cursor', 'data-hud', 'data-out',
                 'class="stage"', 'class="tile"', 'class="pin"']
for node in REQUIRED_HTML:
    if node not in html:
        errors.append('index.html: пропал узел %s' % node)

slides = html.count('<section class="slide')
intro  = html.count('slide--intro')
outs   = html.count('data-out')
if slides != 15:
    errors.append('index.html: слайдов %d вместо пятнадцати' % slides)
# у каждого из пяти разделов свой экран-разбег и свой уезжающий заголовок
if intro != 5 or outs != 5:
    errors.append('index.html: разбегов %d, заголовков %d — должно быть по пять'
                  % (intro, outs))

# 5. Все ссылки на медиа указывают на существующие файлы
refs = set(re.findall(r'(?:src|data-video|href)="(assets/[^"#]+)', html))
for ref in sorted(refs):
    if not os.path.exists(os.path.join(ROOT, ref)):
        errors.append('assets: файл не найден — %s' % ref)
if len(refs) < 60:
    errors.append('assets: слоёв всего %d — разметка обрезана?' % len(refs))

if errors:
    print('ПРОВЕРКА НЕ ПРОЙДЕНА:\n')
    for e in errors:
        print('  ✗', e)
    print('\nвсего проблем: %d' % len(errors))
    sys.exit(1)

print('всё на месте: %d селекторов, %d init-функций, %d слоёв, %d слайдов' % (
    len(REQUIRED_CSS), len(declared), len(refs), slides))
