import importlib.util
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


if __name__ == '__main__':
    unittest.main()
