/**
 * Blog seed content.
 *
 * Three real articles rather than lorem ipsum, so the listing, the cards, the
 * article page, the gallery and the related-posts strip can all be judged on
 * something that looks like the site in use.
 */

export const SEED_BLOG_CATEGORIES = [
  {
    slug: "buying-guides",
    name: "Buying guides",
    description: "How to choose, what to look for, and what the labels actually mean.",
    position: 0,
  },
  {
    slug: "kitchen-notes",
    name: "Kitchen notes",
    description: "Storing, cooking and getting the most out of what you bought.",
    position: 1,
  },
  {
    slug: "shop-updates",
    name: "Shop updates",
    description: "Delivery, returns and news from Trust Mart.",
    position: 2,
  },
] as const;

export type SeedBlogPost = {
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  categorySlug: string;
  tags: string[];
  isFeatured: boolean;
  /** Days before the seed date, so the listing has a believable spread. */
  daysAgo: number;
  seoTitle: string;
  seoDescription: string;
  content: string;
};

export const SEED_BLOG_POSTS: SeedBlogPost[] = [
  {
    slug: "how-to-store-dates-so-they-stay-soft",
    title: "How to store dates so they stay soft",
    subtitle: "Ajwa, Medjool or Mariam — the rules are the same, and most people get one of them wrong.",
    excerpt:
      "Dates dry out because of air, not time. Here is how to keep a kilo soft for six months, and how to bring a hard batch back.",
    categorySlug: "kitchen-notes",
    tags: ["dates", "storage", "ramadan"],
    isFeatured: true,
    daysAgo: 4,
    seoTitle: "How to store dates so they stay soft",
    seoDescription:
      "Keep Ajwa, Medjool and Mariam dates soft for months. Airtight storage, the fridge rule, and how to rescue a dried-out batch.",
    content: `<p>A box of dates that was soft in the shop and hard at home has not gone off. It has dried out, and drying out is about air, not about time.</p>

<h2>Keep them airtight</h2>
<p>Dates are roughly 20&ndash;25% water. Left in an open bowl on a kitchen counter in Dhaka, that water leaves within a week and the sugars crystallise into the gritty texture people mistake for spoilage.</p>
<ul>
  <li><strong>Airtight container.</strong> A jar with a rubber seal, or the bag they came in with the air pressed out and the top folded twice.</li>
  <li><strong>Away from the stove.</strong> Heat speeds up everything above.</li>
  <li><strong>Out of the light.</strong> Direct sun darkens the skin and hardens it.</li>
</ul>

<h2>The fridge rule</h2>
<p>Stored airtight at room temperature, most dates keep well for about a month. In the fridge, six months. In the freezer, well over a year with no loss of texture &mdash; they thaw in twenty minutes and you would not know.</p>
<p>The rule people get wrong: <strong>do not refrigerate them uncovered.</strong> A fridge is a dehumidifier. An open bowl in there dries dates faster than the counter would.</p>

<h2>Rescuing a hard batch</h2>
<p>Hard dates are not wasted. Two options:</p>
<ol>
  <li><strong>Steam.</strong> Five minutes in a steamer, or in a covered bowl over simmering water. They come back almost completely.</li>
  <li><strong>Warm water.</strong> Ten minutes in warm &mdash; not hot &mdash; water, then pat dry. Slightly less good than steaming, but it needs no equipment.</li>
</ol>

<h2>What about the white coating?</h2>
<p>A white bloom on the skin is sugar that has migrated to the surface. It is not mould and it is not a sign the dates are old &mdash; it happens fastest in the fridge. Mould is fuzzy, grey-green, and smells wrong. Sugar bloom is powdery, white, and tastes sweet.</p>

<p>If you are buying in bulk for Ramadan, buy sealed, split it into month-sized jars the day it arrives, and freeze the rest. You will be eating the last of it in the same condition as the first.</p>`,
  },
  {
    slug: "reading-a-mustard-oil-label",
    title: "Reading a mustard oil label",
    subtitle: "Cold pressed, kachi ghani, refined, blended — four words that mean four different products.",
    excerpt:
      "The front of the bottle is marketing. The back is the truth. Here is what each term on a mustard oil label actually commits the producer to.",
    categorySlug: "buying-guides",
    tags: ["mustard oil", "labels", "groceries"],
    isFeatured: false,
    daysAgo: 12,
    seoTitle: "Reading a mustard oil label",
    seoDescription:
      "What cold pressed, kachi ghani, refined and blended actually mean on a mustard oil bottle in Bangladesh, and which one you want.",
    content: `<p>Two bottles of mustard oil on the same shelf can differ by a factor of three in price and share almost nothing in how they were made. The words that tell you which is which are rarely the largest ones on the label.</p>

<h2>Cold pressed / kachi ghani</h2>
<p>The seed is crushed mechanically at low temperature. Nothing is heated, nothing is chemically extracted. The oil keeps its colour (deep amber), its smell (sharp, sinus-clearing) and its pungency &mdash; that bite is allyl isothiocyanate, and it is the honest signature of an unrefined oil.</p>
<p><strong>Kachi ghani</strong> is the same process under its traditional name. Treat the two as interchangeable.</p>

<h2>Refined</h2>
<p>Extracted at higher temperature, often with solvents, then bleached and deodorised. The result is pale, mild and long-lasting. It is not adulterated and it is not unsafe &mdash; it is simply a different product, and it should not cost what cold pressed costs.</p>

<h2>Blended</h2>
<p>Mustard oil mixed with something cheaper, usually palm or soya. Legal, and labelled, but the label is where you find out. If the ingredients list has more than one oil in it, you are buying a blend.</p>

<h2>What to check on the bottle</h2>
<ul>
  <li><strong>The ingredients list.</strong> One line, one oil, for a pure product.</li>
  <li><strong>The packing date, not just the expiry.</strong> Unrefined oil is best inside six months.</li>
  <li><strong>The container.</strong> Dark glass or opaque plastic. Clear bottles under shop lights oxidise faster.</li>
  <li><strong>A BSTI mark.</strong> Not a quality ranking, but its absence is a reason to put the bottle down.</li>
</ul>

<h2>A test you can do at home</h2>
<p>Put a small amount in the freezer for an hour. Pure mustard oil stays liquid and clear. A blend containing palm oil will cloud or partly solidify, because palm oil sets at a much higher temperature. It is not a laboratory test, but it catches the most common adulteration.</p>`,
  },
  {
    slug: "how-cash-on-delivery-works-at-trust-mart",
    title: "How cash on delivery works at Trust Mart",
    subtitle: "What you pay, when you pay it, and what happens if the parcel is wrong.",
    excerpt:
      "Cash on delivery is the default across all 64 districts. Here is exactly what the rider will ask for and what your rights are at the door.",
    categorySlug: "shop-updates",
    tags: ["delivery", "cash on delivery", "returns"],
    isFeatured: false,
    daysAgo: 21,
    seoTitle: "How cash on delivery works at Trust Mart",
    seoDescription:
      "Cash on delivery across all 64 districts of Bangladesh. What you pay at the door, how the delivery charge is calculated, and how returns work.",
    content: `<p>Every order on Trust Mart can be paid for when it reaches you. You do not need a card, and you do not pay anything before the parcel is in your hand.</p>

<h2>What you pay at the door</h2>
<p>The rider collects the total shown on your order confirmation: the price of the goods, minus any discount, plus the delivery charge for your district. That figure is fixed when you place the order &mdash; it does not change in transit, and the rider has no discretion to alter it.</p>

<h2>How the delivery charge is worked out</h2>
<p>It is set per district and shown to you at checkout <em>before</em> you confirm, not afterwards. Dhaka city is the lowest; the further out, the higher. Some products and some promotions carry free delivery, and where they do, the charge line reads zero rather than being quietly folded into the price.</p>

<h2>Checking the parcel</h2>
<p>You may open and check the parcel in front of the rider. If what is inside is not what you ordered, or it arrived damaged, refuse it there and then &mdash; you pay nothing, and it comes straight back to us.</p>

<h2>If you find a problem later</h2>
<p>You have seven days from delivery to report a problem with anything you receive. Contact us with your order number and, where the issue is visible, a photograph. We arrange the return; you do not pay a second delivery charge for our mistake.</p>

<h2>Tracking</h2>
<p>Every parcel gets a tracking number as soon as it leaves us. You can follow it on the <a href="/track-order">track order</a> page with the number, or with the phone number you ordered on &mdash; no account needed.</p>`,
  },
];
