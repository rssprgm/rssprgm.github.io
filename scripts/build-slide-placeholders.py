from base64 import b64encode
from io import BytesIO
import json
from pathlib import Path

from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[1]


def average_grid(image):
    image = image.convert('RGB')
    grid = Image.new('RGB', (8, 8))
    for y in range(8):
        for x in range(8):
            cell = image.crop((x * image.width // 8, y * image.height // 8,
                               (x + 1) * image.width // 8, (y + 1) * image.height // 8))
            grid.putpixel((x, y), tuple(round(channel) for channel in ImageStat.Stat(cell).mean))
    return grid


def main():
    placeholders = {}
    assets = ROOT / 'assets/meetings'
    for path in sorted([*assets.glob('*/slides/*.jpg'), *assets.glob('*/poster.*')]):
        with Image.open(path) as image:
            grid = average_grid(image)
        output = BytesIO()
        grid.save(output, format='BMP')
        placeholders['/' + path.relative_to(ROOT).as_posix()] = 'data:image/bmp;base64,' + b64encode(output.getvalue()).decode()
    (ROOT / '_data/slide_placeholders.json').write_text(json.dumps(placeholders, separators=(',', ':')) + '\n')
    print(f'Generated {len(placeholders)} slide and cover placeholders')


if __name__ == '__main__':
    main()
