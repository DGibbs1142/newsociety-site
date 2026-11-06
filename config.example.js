// TMDB, GNews, Giphy, and Apple/Deezer's chart data all go through Netlify
// serverless functions now (see netlify/functions/) with their keys stored
// as Netlify environment variables — never shipped to the browser. This file
// is only for keys that are still read client-side.
//
// Not loaded by any page: netlify.toml blocks /config.local.js on the live
// site so a key placed here can never be served. To try YouTube locally, add
// <script src="config.local.js"></script> to pop-culture.html on your machine.
//
// Optional — Pop Culture pulls trending videos from YouTube if this is set,
// but skips that source gracefully (no proxy exists for it, since it's
// never actually been configured) if left undefined.
const YOUTUBE_API_KEY = "your-google-cloud-api-key-here";
