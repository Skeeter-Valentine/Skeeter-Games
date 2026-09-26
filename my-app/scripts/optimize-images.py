"""Create web-sized derivatives; preserve the original artwork. Requires Pillow."""
from pathlib import Path
from PIL import Image

assets = Path(__file__).resolve().parents[1] / 'src' / 'assets'
names = ['mineskeeter2', 'ske4dle2', 'skeedle5002', '20482', 'shikaku2',
         'pipes2', 'hashkeet2', 'skeedoku2', 'skeedle+2', 'skeedograms2',
         'skeedlemarathon', 'skitches']
before = after = 0
for name in names + ['logoFog', 'logo2', 'logo']:
    source = assets / (name + ('.jpg' if name == 'logo' else '.png'))
    before += source.stat().st_size
    with Image.open(source) as original:
        picture = original.convert('RGBA')
        picture.thumbnail((640, 640) if name in names else (128, 128), Image.Resampling.LANCZOS)
        target = assets / (name + '.webp')
        picture.save(target, 'WEBP', quality=85, method=6)
        after += target.stat().st_size
        if name == 'logo2':
            picture.save(assets.parents[1] / 'public' / 'favicon.png', 'PNG', optimize=True)
print(f'Artwork: {before:,} -> {after:,} bytes ({(1-after/before)*100:.1f}% smaller)')
