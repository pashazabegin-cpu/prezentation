"""Локальный сервер для просмотра презентации: http://127.0.0.1:8124

Многопоточный (иначе одно видео блокирует остальные запросы)
и с поддержкой Range — чтобы видео можно было перематывать.
"""
import os, re, mimetypes
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = '/Users/kris/Downloads/claude/prezentation'
PORT = 8124


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        pass

    def send_head(self):
        rng = self.headers.get('Range')
        if not rng:
            return super().send_head()

        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().send_head()

        m = re.match(r'bytes=(\d*)-(\d*)', rng)
        if not m:
            return super().send_head()

        size = os.path.getsize(path)
        start = int(m.group(1)) if m.group(1) else 0
        end = int(m.group(2)) if m.group(2) else size - 1
        end = min(end, size - 1)
        if start > end:
            self.send_error(416)
            return None

        f = open(path, 'rb')
        f.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', mimetypes.guess_type(path)[0] or 'application/octet-stream')
        self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Accept-Ranges', 'bytes')
        self.end_headers()
        return _Limited(f, end - start + 1)

    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


class _Limited:
    """Обёртка, отдающая ровно запрошенный кусок файла."""
    def __init__(self, f, remaining):
        self.f = f
        self.remaining = remaining

    def read(self, n=-1):
        if self.remaining <= 0:
            return b''
        if n < 0 or n > self.remaining:
            n = self.remaining
        data = self.f.read(n)
        self.remaining -= len(data)
        return data

    def close(self):
        self.f.close()


if __name__ == '__main__':
    ThreadingHTTPServer.allow_reuse_address = True
    with ThreadingHTTPServer(('127.0.0.1', PORT), Handler) as httpd:
        print('serving %s on http://127.0.0.1:%d' % (ROOT, PORT), flush=True)
        httpd.serve_forever()
