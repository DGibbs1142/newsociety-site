// ===========================================================================
// ISSUE 09 - STAGING DRAFT for Sunday, November 22, 2026.
//
// Code.gs holds exactly ONE NEWSLETTER_ISSUE. Issue 08 is still in it. Paste
// this over it only AFTER Issue 08 has sent, or Issue 08 never reaches anyone.
//
// Before sending Sunday: the Hunger Games block uses Thursday previews ($21M)
// and analysts' projections. If weekend estimates are out by then (studios
// report Sunday morning), swap in the opening number from two sources.
// ---------------------------------------------------------------------------
// VERIFIED (Nov 20, 2026, search checks across two or more outlets each):
// Sports: Heat 137, Bucks 130, Wed Nov 18, Kaseya Center; Giannis 27 pts, 9 ast
//   (rebounds differ by source, 13 vs 14, so left out); Adebayo 26; Heat's 6th
//   straight win; Bucks' 11th straight loss, longest active skid; Herro booed,
//   8 pts. (WSVN, Yahoo Sports x2, Yardbarker)
// Pop culture: Sunrise on the Reaping opened Fri Nov 20 (Lionsgate); Francis
//   Lawrence's 5th in the series; Joseph Zada as young Haymitch; set at the
//   50th Games / Second Quarter Quell. Previews ~$21M (Deadline $21.25M), 2nd in
//   the franchise behind Catching Fire, over 3x Ballad's $5.75M; analysts
//   expect $100M+. (Hollywood Reporter, IndieWire, Screen Rant, JoBlo, Apple TV)
// Music: Langley won Entertainer of the Year (first) + six total: Entertainer,
//   Female Vocalist, Album ("Dandelion"), Single/Song/Video ("Choosin' Texas");
//   nine nominations. (Billboard, ABC7, Rolling Stone, ACountry). "Choosin'
//   Texas" holds the record for most weeks at No. 1 (Billboard, NPR).
// Anime: Witch on the Holy Night opened in Japan Fri Nov 20; ufotable animates,
//   co-produced by Aniplex and TYPE-MOON; US/Canada Jan 29, 2027 via Crunchyroll
//   and Sony, other markets into February. (Outlook Respawn, Anime Corner,
//   Complex, Animation Scoop)
// Fashion: Nike Investor Day Tue Nov 17, "Full Stride Ahead": ~$5B added revenue
//   by fiscal 2031 (from a FY27 base), ~$4B performance sports, ~$1B sportswear;
//   FY27-28 an investment period, market-level growth targeted FY29.
//   (Nike press release, SEC 8-K exhibit, StockAnalysis, FashionUnited)
// Dropped: McQueen/Sean McGirr (announced Oct 15, too old); the "record nine
//   nominations for a woman" claim (one source only).
// ===========================================================================
const NEWSLETTER_ISSUE = {
  number: 9,
  dateline: 'Sunday, November 22, 2026',
  subject: 'The Week in Culture — Ella Langley’s six-trophy night, Giannis vs. the Bucks, and Haymitch’s Games',
  intro: 'Last issue went out on CMA night, so we owe you an ending. Plus Giannis met his old team, and the Hunger Games went back to where Haymitch’s story starts.',
  blocks: [
    {
      tag: 'Music', page: 'music.html', color: '#5aa0e8',
      head: 'Ella Langley walked in holding a record and walked out as Entertainer of the Year.',
      body: 'Here is how CMA night ended: Langley won Entertainer of the Year for the first time and left with six awards — Entertainer, Female Vocalist, Album of the Year for “Dandelion”, and Single, Song and Music Video for “Choosin’ Texas”, the song that has spent more weeks at No. 1 on the Hot 100 than any other. She came in with nine nominations. In September we wrote about her racing herself up the chart. She has run out of chart to race.'
    },
    {
      tag: 'Sports', page: 'sports.html', color: '#4fb3a9',
      head: 'Giannis played the Bucks for the first time, and the Bucks lost again.',
      body: 'Wednesday in Miami: Heat 137, Bucks 130. Antetokounmpo had 27 points and nine assists, one short of a triple-double, and Bam Adebayo added 26. It was Miami’s sixth straight win. Milwaukee has now lost 11 in a row, the longest active skid in the league, and Tyler Herro, the centrepiece of what Milwaukee got back, was booed in his old building and scored eight. Trades are usually judged over years. This one is having a very loud first month.'
    },
    {
      tag: 'Pop culture', page: 'pop-culture.html', color: '#e3a34b',
      head: 'The Hunger Games went back to Haymitch, and the fans showed up early.',
      body: 'The Hunger Games: Sunrise on the Reaping opened Friday, adapting Suzanne Collins’ novel about the 50th Games, the Second Quarter Quell, that a teenage Haymitch Abernathy survived. Joseph Zada plays him, and Francis Lawrence directs his fifth film in the series. Thursday previews brought in about $21 million, second in the franchise only to Catching Fire and more than triple the last prequel’s. Analysts are now talking about a $100 million weekend.'
    },
    {
      tag: 'Anime', page: 'anime.html', color: '#e0679a',
      head: 'Witch on the Holy Night finally made it to the big screen.',
      body: 'The film of TYPE-MOON’s visual novel opened in Japan on Friday, animated by ufotable, the studio behind Demon Slayer’s anime, and co-produced with Aniplex. TYPE-MOON is the same company that made Fate, so this is a fan-favourite studio adapting a fan-favourite story. Everyone else waits a little longer: the U.S. and Canada get it on January 29 through Crunchyroll and Sony, with more countries following into February.'
    },
    {
      tag: 'Fashion', page: 'fashion.html', color: '#b58cff',
      head: 'Nike told investors the comeback runs through 2029.',
      body: 'At its investor day on Tuesday, Nike laid out a plan it calls Full Stride Ahead: about $5 billion in added revenue by fiscal 2031, roughly $4 billion of it from performance sports like running and basketball and $1 billion from sportswear. The next two years are framed as investment, with a return to market-level growth targeted for fiscal 2029. For the brand that built sneaker culture, the bet is that the way back runs through the shoes people actually play in.'
    }
  ],
  live: 'Launch party incoming. The date and venue are almost locked, and this list hears first.',
  liveRsvp: 'You’re on the launch party list. The date and venue are almost locked, and you’ll hear first.',
  closer: 'What do you want more of? Hit reply. We read every one.'
};
