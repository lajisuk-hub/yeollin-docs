# public/base.hwpx 의 글꼴·모양을 PDF(화면)와 비슷하게 맞춘다 (2026-09-19)
#  - 본문 글꼴 휴먼명조 → 경기천년바탕 Regular (원장님 지정. PC에 글꼴이 없으면 한글이 대체 글꼴로 보여 준다)
#  - 제목·소제목·본문 글자색을 남색/회색 → 진한 먹색(화면과 동일)
#  - 소제목용 초록 세로띠: borderFill 6 + paraPr 29(다음 문단과 붙어 다님)
# 한 번만 실행한다. (이미 바꾼 파일이면 아무것도 하지 않음)
import zipfile, re, shutil, sys, io
SRC = 'public/base.hwpx'
z = zipfile.ZipFile(SRC)
h = z.read('Contents/header.xml').decode('utf-8')
if '경기천년바탕' in h:
    print('already restyled'); sys.exit(0)
# 글꼴 3 = 경기천년바탕 Regular, 글꼴 4 = 경기천년바탕 Bold (제목·소제목·표 머리글)
# PC마다 TTF(경기천년바탕)나 OTF(경기천년바탕OTF) 중 하나만 깔려 있어 substFont로 둘 다 받는다 (한글에서 실제 확인)
def fontxml(i, face, otf, weight):
    return ('<hh:font id="%d" face="%s" type="TTF" isEmbedded="0"><hh:substFont face="%s" type="TTF" isEmbedded="0" binaryItemIDRef=""/>'
            '<hh:typeInfo familyType="FCAT_MYUNGJO" weight="%d" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/></hh:font>') % (i, face, otf, weight)
h = re.sub(r'<hh:font id="3" face="휴먼명조".*?</hh:font>', lambda m: fontxml(3, '경기천년바탕 Regular', '경기천년바탕OTF Regular', 6), h, flags=re.S)
h = re.sub(r'(<hh:fontface lang="\w+" fontCnt=")4(">.*?)(</hh:fontface>)',
           lambda m: m.group(1) + '5' + m.group(2) + fontxml(4, '경기천년바탕 Bold', '경기천년바탕OTF Bold', 8) + m.group(3), h, flags=re.S)

def edit_char(i, fn):
    global h
    m = re.search(r'<hh:charPr id="%d".*?</hh:charPr>' % i, h, re.S)
    h = h[:m.start()] + fn(m.group(0)) + h[m.end():]
def fontN(n):
    return lambda x: re.sub(r'<hh:fontRef [^>]*/>', '<hh:fontRef hangul="%d" latin="%d" hanja="%d" japanese="%d" other="%d" symbol="%d" user="%d"/>' % ((n,) * 7), x)
def style(height=None, color=None, font=3):
    def f(x):
        x = fontN(font)(x)
        if font == 4: x = x.replace('<hh:bold/>', '')  # 굵은 글꼴을 직접 쓴다
        if height: x = re.sub(r'height="\d+"', 'height="%d"' % height, x, 1)
        if color: x = re.sub(r'textColor="#[0-9A-Fa-f]+"', 'textColor="%s"' % color, x, 1)
        return x
    return f
edit_char(16, style(1800, '#1A1A1A', 4))   # 제목 18pt 굵게
edit_char(17, style(1250, '#1A1A1A', 4))   # 소제목 12.5pt 굵게
edit_char(18, style(1050, '#1A1A1A'))   # 본문 10.5pt
edit_char(15, style(1200, '#1A1A1A'))   # 어린이집 이름
edit_char(2, style(900, '#555555'))     # 안내 문구
edit_char(8, style(1000, '#1A1A1A', 4))    # 표 머리글

# 초록 세로띠 (화면의 .doc-heading 왼쪽 띠와 같은 색)
bf = ('<hh:borderFill id="6" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">'
      '<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>'
      '<hh:leftBorder type="SOLID" width="1.0 mm" color="#2E7D68"/><hh:rightBorder type="NONE" width="0.1 mm" color="#FFFFFF"/>'
      '<hh:topBorder type="NONE" width="0.1 mm" color="#FFFFFF"/><hh:bottomBorder type="NONE" width="0.1 mm" color="#FFFFFF"/>'
      '<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/></hh:borderFill>')
h = h.replace('<hh:borderFills itemCnt="5">', '<hh:borderFills itemCnt="6">').replace('</hh:borderFills>', bf + '</hh:borderFills>')

p26 = re.search(r'<hh:paraPr id="26".*?</hh:paraPr>', h, re.S).group(0)
p29 = p26.replace('id="26"', 'id="29"', 1).replace('keepWithNext="0"', 'keepWithNext="1"')
p29 = re.sub(r'<hh:border borderFillIDRef="\d+" offsetLeft="\d+" offsetRight="\d+" offsetTop="\d+" offsetBottom="\d+"',
             '<hh:border borderFillIDRef="6" offsetLeft="700" offsetRight="0" offsetTop="150" offsetBottom="150"', p29)
assert 'borderFillIDRef="6"' in p29
# 그림 조각용 문단 (여백 0 · 줄간격 100%) — 잘게 자른 표 그림을 이음매 없이 쌓는다
p21 = re.search(r'<hh:paraPr id="21".*?</hh:paraPr>', h, re.S).group(0)
p30 = re.sub(r'<hh:lineSpacing type="PERCENT" value="\d+"', '<hh:lineSpacing type="PERCENT" value="100"', p21.replace('id="21"', 'id="30"', 1))
h = h.replace('<hh:paraProperties itemCnt="29">', '<hh:paraProperties itemCnt="31">').replace('</hh:paraProperties>', p29 + p30 + '</hh:paraProperties>')

tmp = SRC + '.tmp'
out = zipfile.ZipFile(tmp, 'w')
for info in z.infolist():
    data = z.read(info.filename)
    if info.filename == 'Contents/header.xml': data = h.encode('utf-8')
    out.writestr(zipfile.ZipInfo('mimetype') if info.filename == 'mimetype' else info.filename, data,
                 compress_type=zipfile.ZIP_STORED if info.filename == 'mimetype' else zipfile.ZIP_DEFLATED)
out.close(); z.close(); shutil.move(tmp, SRC)
print('restyled')
