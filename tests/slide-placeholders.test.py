from base64 import b64decode
from io import BytesIO
import importlib.util
import json
from pathlib import Path
import unittest

from PIL import Image

spec = importlib.util.spec_from_file_location('placeholders', Path(__file__).resolve().parents[1] / 'scripts/build-slide-placeholders.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AverageGridTest(unittest.TestCase):
    def test_averages_each_cell_independently(self):
        image = Image.new('RGB', (16, 16), (20, 40, 60))
        image.putpixel((0, 0), (100, 120, 140))
        grid = module.average_grid(image)
        self.assertEqual(grid.size, (8, 8))
        self.assertEqual(grid.getpixel((0, 0)), (40, 60, 80))
        self.assertEqual(grid.getpixel((1, 0)), (20, 40, 60))

    def test_slides_and_covers_keep_compact_rgb_grids(self):
        assets = module.ROOT / 'assets/meetings'
        paths = sorted([*assets.glob('*/slides/*.jpg'), *assets.glob('*/poster.*')])
        placeholders = json.loads((module.ROOT / '_data/slide_placeholders.json').read_text())
        self.assertEqual(set(placeholders), {'/' + path.relative_to(module.ROOT).as_posix() for path in paths})
        for path in paths:
            with self.subTest(path=path):
                value = placeholders['/' + path.relative_to(module.ROOT).as_posix()]
                prefix, data = value.split(',', 1)
                self.assertEqual(prefix, 'data:image/bmp;base64')
                with Image.open(BytesIO(b64decode(data))) as mesh:
                    self.assertEqual(mesh.format, 'BMP')
                    self.assertEqual(mesh.size, (8, 8))
                    with Image.open(path) as source:
                        expected = module.average_grid(source)
                    self.assertEqual(mesh.convert('RGB').tobytes(), expected.tobytes())


if __name__ == '__main__':
    unittest.main()
