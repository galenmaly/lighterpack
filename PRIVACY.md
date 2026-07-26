# Privacy Policy

**Effective date:** July 26, 2026

LighterPack is a website for tracking the gear you take on adventures. It is
operated by Galen Maly and is open source under the GPL-2.0 license — you can
read every line of the code that handles your data at
[github.com/galenmaly/lighterpack](https://github.com/galenmaly/lighterpack).

## The short version

We collect the minimum needed to run the site: a username, an email address, and
whatever you choose to put in your gear lists. We don't run ads, we don't use
analytics or tracking cookies, we don't have third-party trackers of any kind,
and we have never sold or shared your data with anyone for marketing purposes.
You can delete your account yourself at any time.

The rest of this document is the detail.

## What we collect

### Account information

When you create an account we store:

- **Your username**
- **Your email address**
- **Your password** - hashed with bcrypt.

Everything you enter into LighterPack including list names, item names, descriptions,
weights, prices, quantities, links, and the images you upload, is stored in our
database and associated with your account. We attempt to strip all EXIF metadata from uploaded images.

### Server logs

Every request to the site is logged. Each log line records:

- your IP address
- your browser's user-agent string
- the URL requested and the referring URL
- the HTTP method, response status, response size, and response time
- your username, if you were signed in
- a random request identifier

These logs exist to debug problems, understand load, and investigate abuse.

### Cookies

LighterPack sets two cookies, both functional:

| Cookie | Purpose | Lifetime |
| --- | --- | --- |
| `lp` | Your session token — this is what keeps you signed in. Not readable by JavaScript. | 1 year |
| `lp_loggedin` | A flag that tells the page you're signed in so it can render the right navigation. Contains no personal data. | 1 year |

**We set no advertising, analytics, or tracking cookies**, and no third party
sets cookies through our site.

## What we don't do

- We don't run ads.
- We don't use Google Analytics or any other analytics service.
- We don't embed third-party trackers, pixels, or social widgets.
- We don't sell, rent, or trade your personal information.

## Who else handles your data

- **Linode** — hosts the application and database, and
  therefore stores everything above on our behalf.
- **Mailgun** — delivers the transactional email we
  send. Your email address is passed to Mailgun when we send transactional emails.

We used to use Imgur to store images. Newly uploaded images are stored by LighterPack.
No one else receives your data, except where required by law.

## Email we send you

We send a couple kinds of email:
- Emails you asked for - username remind, password reset
- Service emails - if something needs your attention
- Maybe one day we'll send a newsletter. We haven't yet.

We do not send marketing email, so there is nothing to unsubscribe from.

## Lists you share are public

When you share a list, LighterPack gives it a URL. Anyone who has
that link can view the list, embed it, or export it as CSV — **no account and no
password is required.**. Shared list URLs are hard to guess but they are unlisted, not private.

Images you upload are likewise served from public URLs and can be viewed by
anyone who has the link.

## Support and moderation access

Site moderators can search accounts by username or email address, reset a
user's password, and sign a user out of all sessions. This exists to handle
account-recovery requests and abuse reports. Moderators cannot read your password.

## Deleting your account and accessing your data

You can delete your account yourself from **Account → Delete account**. It asks
for your password to confirm.

Deleting your account **immediately and permanently removes**:

- your user record, including your email address and password hash
- all of your gear lists and their contents
- your uploaded photos that are hosted by LighterPack

## Your rights

You have the right to:
 - Delete your account and all its associated data
 - Export all of your data

You can perform these actions yourself from the account menu when logged into LighterPack.

## Law enforcement and legal requests

We will disclose information if we are legally required to.

## Contact

Questions about this policy, or about your data: **info@lighterpack.com**
