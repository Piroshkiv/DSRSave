#!/usr/bin/env python3
"""
Parser for Dark Souls 3 Cheat Engine Table (CT) to items.json
Converts DS3_TGA_v3.4.0.CT to items.json format compatible with DS1 save editor
"""

import re
import json
from pathlib import Path

# Type mappings from DS3 to hex category codes
TYPE_MAPPINGS = {
    'Weapon': '0x0',
    'Armor': '0x10000000',
    'Ring': '0x20000000',
    'Magic': '0x40000000',
    'Consumable': '0x40000000'
}

# Category mappings
CATEGORY_MAPPINGS = {
    'Weapon': 'weapons_shields',
    'Armor': 'armor',
    'Ring': 'rings',
    'Magic': 'magic',
    'Consumable': 'consumables'
}

def parse_ct_file(ct_path):
    """Parse CT file and extract all items"""

    items = {
        'weapon_items': [],
        'armor_items': [],
        'ring_items': [],
        'magic_items': [],
        'consumable_items': []
    }

    with open(ct_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # Parse Weapons
    weapon_pattern = r"Weapon:new\(\{id = (0x[0-9A-Fa-f]+)(?:, typ = '([^']+)')?(?:, dlc = \d+)?(?:, cutContent = true)?\}\),?\s*--([^\n]+)"
    for match in re.finditer(weapon_pattern, content):
        item_id, typ, name = match.groups()
        name = name.strip()

        # Skip cut content
        if 'cutContent' in match.group(0):
            continue

        item = {
            'Type': TYPE_MAPPINGS['Weapon'],
            'Id': item_id,
            'MaxStackCount': 1,
            'Category': typ.lower() if typ else 'weapons_shields',
            'Name': name
        }
        items['weapon_items'].append(item)

    # Parse Armor
    armor_pattern = r"Armor:new\(\{id = (0x[0-9A-Fa-f]+)(?:, typ = '([^']+)')?(?:, dlc = \d+)?(?:, cutContent = true)?\}\),?\s*--([^\n]+)"
    for match in re.finditer(armor_pattern, content):
        item_id, typ, name = match.groups()
        name = name.strip()

        if 'cutContent' in match.group(0):
            continue

        item = {
            'Type': TYPE_MAPPINGS['Armor'],
            'Id': item_id,
            'MaxStackCount': 1,
            'Category': typ.lower() if typ else 'armor',
            'Name': name
        }
        items['armor_items'].append(item)

    # Parse Rings
    ring_pattern = r"Ring:new\(\{id = (0x[0-9A-Fa-f]+)(?:, dlc = \d+)?(?:, cutContent = true)?\}\),?\s*--([^\n]+)"
    for match in re.finditer(ring_pattern, content):
        item_id, name = match.groups()
        name = name.strip()

        if 'cutContent' in match.group(0):
            continue

        item = {
            'Type': TYPE_MAPPINGS['Ring'],
            'Id': item_id,
            'MaxStackCount': 1,
            'Category': 'rings',
            'Name': name
        }
        items['ring_items'].append(item)

    # Parse Magic/Spells
    magic_pattern = r"Magic:new\(\{id = (0x[0-9A-Fa-f]+)(?:, typ = \"([^\"]+)\")?(?:, dlc = \d+)?(?:, cutContent = true)?\}\),?\s*--([^\n]+)"
    for match in re.finditer(magic_pattern, content):
        item_id, typ, name = match.groups()
        name = name.strip()

        if 'cutContent' in match.group(0):
            continue

        item = {
            'Type': TYPE_MAPPINGS['Magic'],
            'Id': item_id,
            'MaxStackCount': 1,
            'Category': typ.lower() if typ else 'magic',
            'Name': name
        }
        items['magic_items'].append(item)

    # Parse Consumables
    consumable_pattern = r"Consumable:new\(\{id = (0x[0-9A-Fa-f]+)(?:, typ = '([^']+)')?(?:, quantity = (\d+))?(?:, dlc = \d+)?(?:, unsafe = true)?(?:, cutContent = true)?\}\),?\s*--+([^\n]+)"
    for match in re.finditer(consumable_pattern, content):
        item_id, typ, quantity, name = match.groups()
        name = name.strip()

        if 'cutContent' in match.group(0):
            continue

        max_stack = int(quantity) if quantity else 99

        item = {
            'Type': TYPE_MAPPINGS['Consumable'],
            'Id': item_id,
            'MaxStackCount': max_stack,
            'Category': typ.lower() if typ else 'consumables',
            'Name': name
        }
        items['consumable_items'].append(item)

    return items


def main():
    ct_path = Path(r'C:\Users\Iho\Desktop\DS3_TGA_v3.4.0.CT')
    output_path = Path(r'C:\Users\Iho\source\repos\DSRSave\ds1-save-editor\public\json\ds3_items.json')

    print(f"Parsing {ct_path}...")
    items = parse_ct_file(ct_path)

    print(f"\nFound items:")
    print(f"  Weapons: {len(items['weapon_items'])}")
    print(f"  Armor: {len(items['armor_items'])}")
    print(f"  Rings: {len(items['ring_items'])}")
    print(f"  Magic: {len(items['magic_items'])}")
    print(f"  Consumables: {len(items['consumable_items'])}")

    # Create output directory if it doesn't exist
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write JSON
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(items, f, indent=2, ensure_ascii=False)

    print(f"\nSaved to: {output_path}")

if __name__ == '__main__':
    main()
