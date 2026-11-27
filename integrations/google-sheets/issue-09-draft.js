// ===========================================================================
// ISSUE 09 - STAGING DRAFT for Sunday, November 29, 2026 (Thanksgiving weekend).
//
// MERGED Nov 27 at Daniel's request: the old Issue 09 (Nov 22) and Issue 10
// (Nov 29) drafts never went out, and neither did Issue 08 (Nov 18). Subscribers'
// last email was Issue 07 (Nov 8), so this one stands alone and catches them up.
// Issue 08 stays on the website as a web-only issue (archived Nov 18).
//
// Since Nov 27 this issue is also in Code.gs itself, so paste the WHOLE Code.gs
// into Apps Script, then previewNewsletter(), sendNewsletter() and
// sendNewsletterToRsvps(). After it sends:
//   python3 integrations/google-sheets/add-issue.py .
//
// Before sending Sunday: if the studios' Thanksgiving five-day totals are out,
// swap them in for the Hexed / Focker In-Law Wednesday numbers (two sources).
// ---------------------------------------------------------------------------
// VERIFIED (search checks across two or more outlets, or the official source):
// Sports (Nov 27): Bears 39, Lions 35 on Thanksgiving at Ford Field; Detroit led
//   by 11 late; Williams to Odunze from 6 yds with 3 seconds left after a 13-play
//   drive in the final 2:14; Bears 9-2, alone atop the NFC North. (NFL.com, Yahoo
//   x2, Fox 32, DAZN, ClickOnDetroit, Bleacher Nation)
// Pop culture: Sunrise on the Reaping opened Nov 20-22 to ~$120M domestic
//   (Box Office Mojo $119.3M) and ~$225M worldwide; Thursday previews ~$21M;
//   Joseph Zada as young Haymitch. (Hollywood Reporter, Variety, Box Office Mojo,
//   IndieWire). Wed Nov 25: Hexed (Disney) $7.6M, A- CinemaScore; Focker In-Law
//   (Universal) $5.3M; both tracking ~$35M over five days. (Variety, Deadline)
// Music: CMAs Nov 18: Langley won Entertainer of the Year (first) and six awards:
//   Entertainer, Female Vocalist, Album ("Dandelion"), Single/Song/Video
//   ("Choosin' Texas"). (Billboard, ABC7, Rolling Stone, ACountry). Hot 100 dated
//   Nov 28: "Choosin' Texas" 29th week at No. 1; "Last Christmas" into the top
//   five (Billboard's own countdown). Record over "All I Want for Christmas Is
//   You" (Billboard, Axios, CTV).
// Anime: Witch on the Holy Night opened in Japan Nov 20 (ufotable; Aniplex,
//   TYPE-MOON); sequel confirmed in a post-credits scene and by the official
//   account, no date; US/Canada Jan 29, 2027 via Crunchyroll and Sony.
//   (Outlook Respawn, Anime Corner, Complex, Crunchyroll News, Final Weapon)
// Fashion: The Fashion Awards, Mon Nov 30, Royal Albert Hall; Ncuti Gatwa hosts.
//   (British Fashion Council x2, Style Rave). Martine Rose named Balenciaga
//   creative director Nov 6 (Kering, Wallpaper, FashionNetwork, Complex).
// Dropped from the old drafts: Giannis vs. the Bucks (Nov 18, now stale), Nike
//   investor day (Nov 17), and Issue 08's stories (Nov 9-16 news).
// ===========================================================================
const NEWSLETTER_ISSUE = {
  number: 9,
  dateline: 'Sunday, November 29, 2026',
  subject: 'The Week in Culture — Haymitch’s $120 million weekend, Ella Langley’s six CMAs, and the Bears steal Thanksgiving',
  intro: 'We missed a couple of Sundays, so this one catches you up: the biggest weekend of the year at the movies, the biggest night of the year in country, and a Thanksgiving comeback in Detroit.',
  blocks: [
    {
      tag: 'Pop culture', page: 'pop-culture.html', color: '#e3a34b',
      head: 'Haymitch’s Games opened to $120 million.',
      body: 'The Hunger Games: Sunrise on the Reaping, with Joseph Zada as a teenage Haymitch Abernathy, made about $120 million in the U.S. and Canada and $225 million worldwide in its first weekend, after $21 million in Thursday previews alone. It was still leading on Thanksgiving eve, ahead of two newcomers: Disney’s original Hexed, which opened to $7.6 million and an A- CinemaScore, and Universal’s Focker In-Law at $5.3 million.'
    },
    {
      tag: 'Music', page: 'music.html', color: '#5aa0e8',
      head: 'Ella Langley won six CMAs, and Christmas still can’t knock her off No. 1.',
      body: 'At the CMA Awards, Langley won her first Entertainer of the Year and left with six awards: Entertainer, Female Vocalist, Album of the Year for “Dandelion”, and Single, Song and Music Video for “Choosin’ Texas”. A week later the Christmas songs arrived on the Hot 100, Wham!’s “Last Christmas” straight into the top five, and “Choosin’ Texas” held No. 1 anyway, for a 29th week. Mariah Carey, whose record it broke, usually climbs all December. The rematch is coming.'
    },
    {
      tag: 'Sports', page: 'sports.html', color: '#4fb3a9',
      head: 'The Bears stole Thanksgiving in Detroit.',
      body: 'Down 11 in the fourth quarter at Ford Field, Chicago came back to win 39-35. Caleb Williams hit Rome Odunze for a long touchdown to get close, then drove 13 plays in the final 2:14 and found Odunze again from six yards out with three seconds left. Jahmyr Gibbs ran for three touchdowns and still lost. The Bears are 9-2 and alone in first in the NFC North, and they took it from the team that was chasing them.'
    },
    {
      tag: 'Anime', page: 'anime.html', color: '#e0679a',
      head: 'Witch on the Holy Night made it to the big screen, and a sequel is already coming.',
      body: 'The film of TYPE-MOON’s visual novel, animated by ufotable, the studio behind Demon Slayer’s anime, opened in Japan on November 20. Days later a post-credits scene confirmed a second film, and the official account says it is in production, with no date yet. TYPE-MOON also made Fate, so this is a fan-favourite studio adapting a fan-favourite story. The U.S. and Canada get the first film on January 29.'
    },
    {
      tag: 'Fashion', page: 'fashion.html', color: '#b58cff',
      head: 'The Fashion Awards are Monday in London.',
      body: 'The British Fashion Council’s Fashion Awards take over the Royal Albert Hall on Monday, November 30, with Ncuti Gatwa hosting. The night doubles as the big fundraiser for the BFC Foundation. It closes an autumn of designer moves, including Martine Rose becoming the first woman to lead Balenciaga, so expect the speeches to be about what comes next. The winners land after this does.'
    }
  ],
  live: 'Launch party incoming. The date and venue are almost locked, and this list hears first.',
  liveRsvp: 'You’re on the launch party list. The date and venue are almost locked, and you’ll hear first.',
  closer: 'What do you want more of? Hit reply. We read every one.'
};
