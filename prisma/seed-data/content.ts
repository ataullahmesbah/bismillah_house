/** Starter policy pages and FAQ entries. Edit them from the dashboard afterwards. */

export const SEED_PAGES = [
  {
    slug: "shipping",
    title: "Shipping & Delivery",
    type: "POLICY" as const,
    position: 1,
    excerpt: "How long delivery takes and what it costs across all 64 districts.",
    content: `
<h2>Delivery coverage</h2>
<p>We deliver to all 64 districts of Bangladesh. Delivery charges are set per district and shown to you at checkout before you confirm your order.</p>

<h2>Delivery time</h2>
<ul>
  <li><strong>Inside Dhaka:</strong> usually 1–2 working days.</li>
  <li><strong>Outside Dhaka:</strong> usually 2–4 working days.</li>
  <li><strong>Hill districts and remote areas:</strong> may take an extra day.</li>
</ul>

<h2>Delivery charges</h2>
<p>The exact charge depends on your district and on the products in your cart. Some products carry free delivery and some carry a product-specific charge — both are shown on the product page and again in your cart total.</p>

<h2>Order confirmation</h2>
<p>Our team calls the mobile number on the order to confirm it before dispatch. Please keep your phone reachable so your parcel is not delayed.</p>

<h2>Failed delivery</h2>
<p>If the courier cannot reach you, they will attempt delivery again. Repeatedly refusing a confirmed cash-on-delivery order may limit future ordering.</p>
`.trim(),
  },
  {
    slug: "returns",
    title: "Returns & Exchanges",
    type: "POLICY" as const,
    position: 2,
    excerpt: "What you can return, when, and how to start the process.",
    content: `
<h2>Return window</h2>
<p>You may request a return within <strong>7 days</strong> of delivery for products that arrived damaged, defective, or materially different from what was described.</p>

<h2>What can be returned</h2>
<ul>
  <li>Damaged or defective items.</li>
  <li>Wrong item or wrong variant delivered.</li>
  <li>Items missing from the parcel.</li>
</ul>

<h2>What cannot be returned</h2>
<ul>
  <li>Perishable food items once the seal is opened.</li>
  <li>Personal care and hygiene products that have been used.</li>
  <li>Items damaged through misuse after delivery.</li>
</ul>

<h2>How to start a return</h2>
<p>Open your order in <a href="/account/orders">My orders</a> and message our support team, or call the number on our <a href="/contact">contact page</a>. Keep the original packaging and the invoice that came with the parcel.</p>
`.trim(),
  },
  {
    slug: "refund-policy",
    title: "Refund Policy",
    type: "POLICY" as const,
    position: 3,
    excerpt: "When refunds are issued and how long they take.",
    content: `
<h2>When we refund</h2>
<p>A refund is issued once an approved return is received and checked, or when an order you already paid for is cancelled before dispatch.</p>

<h2>Refund method</h2>
<ul>
  <li><strong>Cash on delivery orders:</strong> refunded through bKash or bank transfer to the number or account you provide.</li>
  <li><strong>bKash and online payments:</strong> refunded to the original payment method wherever the provider allows it.</li>
</ul>

<h2>Timing</h2>
<p>Refunds are normally processed within 3–7 working days of approval. Your bank or mobile wallet may take a little longer to show the money.</p>

<h2>Delivery charges</h2>
<p>Delivery charges are refunded when the fault was ours — a damaged, defective or incorrect item. They are not refunded when an order is returned because the customer changed their mind.</p>
`.trim(),
  },
  {
    slug: "terms",
    title: "Terms & Conditions",
    type: "POLICY" as const,
    position: 4,
    excerpt: "The rules that apply when you shop with us.",
    content: `
<h2>Using this website</h2>
<p>By placing an order you confirm that the information you provide is accurate and that you are able to receive the order at the address given.</p>

<h2>Pricing</h2>
<p>All prices are in Bangladeshi Taka and include applicable taxes unless stated otherwise. Prices, offers and stock levels can change at any time; the price confirmed on your order is the price that applies.</p>

<h2>Orders</h2>
<p>An order is an offer to buy. We may decline or cancel an order if a product is out of stock, if the pricing was clearly wrong, or if we cannot verify the delivery details.</p>

<h2>Coupons and offers</h2>
<p>Coupons and promotional offers are valid only within their stated period, on eligible products, and subject to their usage limits. Unless a coupon explicitly allows it, coupons do not stack with other promotions.</p>

<h2>Cancellation</h2>
<p>You can cancel an order yourself while it is still pending or confirmed. After it has been packed or shipped, please contact support.</p>

<h2>Reviews</h2>
<p>Only customers who have received a product may review it. We remove reviews that are abusive, fake, or unrelated to the product.</p>

<h2>Liability</h2>
<p>Our liability for any order is limited to the amount you paid for that order.</p>
`.trim(),
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    type: "POLICY" as const,
    position: 5,
    excerpt: "What data we collect, why, and how we protect it.",
    content: `
<h2>What we collect</h2>
<ul>
  <li>Your name, mobile number, email and delivery address, so we can deliver your order.</li>
  <li>Your order and payment history, so support can help you.</li>
  <li>Basic technical data such as IP address and browser type, for security and fraud prevention.</li>
</ul>

<h2>How we use it</h2>
<p>We use your data to process orders, arrange delivery, provide support, prevent fraud and — where you have not opted out — tell you about relevant offers.</p>

<h2>Who we share it with</h2>
<p>We share only what is necessary: your name, address and phone number with the courier delivering your parcel, and payment references with the payment provider you chose. We do not sell your personal data.</p>

<h2>Analytics</h2>
<p>We may use analytics and advertising tools to understand how the shop is used. These receive product and page information, not your name, phone number or address.</p>

<h2>Security</h2>
<p>Passwords are stored only as secure hashes. Access to customer data inside our dashboard is limited by role and every sensitive action is logged.</p>

<h2>Your choices</h2>
<p>You can update your details from <a href="/account/profile">your profile</a>, or contact us to request deletion of your account.</p>
`.trim(),
  },
  {
    slug: "cookie-policy",
    title: "Cookie & Tracking Policy",
    type: "POLICY" as const,
    position: 6,
    excerpt: "The cookies this shop uses and what they do.",
    content: `
<h2>Essential cookies</h2>
<p>These keep you signed in and keep the items in your cart. The shop cannot work without them.</p>

<h2>Analytics and advertising</h2>
<p>If enabled, these help us understand which products people look at and measure our advertising. Where consent is required, nothing loads until you accept.</p>

<h2>Managing cookies</h2>
<p>You can clear or block cookies in your browser settings. Blocking essential cookies will stop the cart and sign-in from working.</p>
`.trim(),
  },
  {
    slug: "about",
    title: "About Trust Mart",
    type: "HELP" as const,
    position: 7,
    excerpt: "Who we are and how we work.",
    content: `
<h2>Our promise</h2>
<p>Trust Mart exists to make online shopping in Bangladesh predictable: genuine products, prices that do not change after you order, and delivery you can track.</p>

<h2>How we work</h2>
<ul>
  <li>Every price and discount is calculated on our servers, so what you see at checkout is what you pay.</li>
  <li>Reviews come only from customers who actually received the product.</li>
  <li>Cash on delivery is available nationwide, so you can pay when your parcel arrives.</li>
</ul>
`.trim(),
  },
];

export const SEED_FAQS = [
  {
    category: "Ordering",
    question: "Do I need an account to place an order?",
    answer: "<p>No. Guest checkout is available, though creating an account lets you track orders, save addresses and reorder faster. A Super Admin can require sign-in for checkout at any time.</p>",
  },
  {
    category: "Ordering",
    question: "How do I know my order was placed?",
    answer: "<p>You are taken to a confirmation page with your order number, and our team calls the mobile number on the order to confirm before dispatch. You can also check the status any time on the <a href=\"/track-order\">order tracking page</a>.</p>",
  },
  {
    category: "Ordering",
    question: "Can I cancel my order?",
    answer: "<p>Yes, while the order is still pending or confirmed you can cancel it yourself from <a href=\"/account/orders\">My orders</a>. Once it has been packed or shipped, contact support instead.</p>",
  },
  {
    category: "Delivery",
    question: "How much is delivery?",
    answer: "<p>It depends on your district. The exact charge appears at checkout as soon as you choose your district. Some products carry free delivery and some carry their own fixed charge — both are shown on the product page.</p>",
  },
  {
    category: "Delivery",
    question: "How long does delivery take?",
    answer: "<p>Typically 1–2 working days inside Dhaka and 2–4 working days elsewhere. Remote and hill districts can take an extra day.</p>",
  },
  {
    category: "Delivery",
    question: "Do you deliver to my district?",
    answer: "<p>Yes — we deliver to all 64 districts of Bangladesh.</p>",
  },
  {
    category: "Payment",
    question: "What payment methods can I use?",
    answer: "<p>Cash on Delivery is always available. bKash and online card payment are available when enabled by the shop; you will see them at checkout if they are.</p>",
  },
  {
    category: "Payment",
    question: "Is cash on delivery available everywhere?",
    answer: "<p>Yes, cash on delivery is available in every district we deliver to.</p>",
  },
  {
    category: "Coupons",
    question: "Why is my coupon not working?",
    answer: "<p>A coupon can be refused because it has expired, has not started yet, has reached its usage limit, does not cover the products in your cart, or your cart is below the minimum amount. The checkout page tells you which of these applies.</p>",
  },
  {
    category: "Coupons",
    question: "Can I use a coupon on flash-sale items?",
    answer: "<p>Only if the coupon explicitly allows it. By default coupons do not apply to flash-sale items so that campaigns are not double-discounted.</p>",
  },
  {
    category: "Returns",
    question: "How do I return an item?",
    answer: "<p>Open the order in <a href=\"/account/orders\">My orders</a> and message support within 7 days of delivery. Keep the original packaging and the invoice from the parcel. Full details are on our <a href=\"/returns\">returns page</a>.</p>",
  },
  {
    category: "Returns",
    question: "When will I get my refund?",
    answer: "<p>Refunds are normally processed within 3–7 working days of approval. See the <a href=\"/refund-policy\">refund policy</a> for details.</p>",
  },
  {
    category: "Account",
    question: "Can I review a product I bought?",
    answer: "<p>Yes — once your order is delivered, the product appears under <a href=\"/account/reviews\">My reviews</a> and you can rate and review it. Only customers who received the product can review it.</p>",
  },
  {
    category: "Account",
    question: "I forgot my password. What now?",
    answer: "<p>Use the <a href=\"/forgot-password\">forgot password</a> page. For your security, resetting your password signs you out of every other device.</p>",
  },
];
