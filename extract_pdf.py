import PyPDF2
import glob
import sys

files = glob.glob('*TD-esc-03*.pdf')
if not files:
    print('File not found')
    sys.exit(1)

reader = PyPDF2.PdfReader(files[0])
for i, page in enumerate(reader.pages):
    print(f'\\n--- Page {i+1} ---')
    print(page.extract_text().encode('ascii', 'ignore').decode('ascii'))
