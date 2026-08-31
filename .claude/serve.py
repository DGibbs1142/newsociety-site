import functools, http.server, socketserver, os, sys
d = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(d)
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=d)
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", 8000), H) as httpd:
    print("serving", d, "on 8000", flush=True)
    httpd.serve_forever()
