# =============================================================================
# BF LOGISTICS — static site assembler
#
# Stitches _build/layout.html (shared header, footer, nav, schema) around each
# body fragment in _build/pages/ and writes plain .html files to the site root.
#
# The OUTPUT is ordinary static HTML — nothing here is needed to view or host
# the site. This exists only so the header and footer stay identical across all
# sixteen pages. Edit a fragment, re-run this, and the site is rebuilt.
#
#   powershell -ExecutionPolicy Bypass -File _build\build.ps1
# =============================================================================

$ErrorActionPreference = 'Stop'

$buildDir = $PSScriptRoot
$root     = Split-Path $buildDir -Parent
$pagesDir = Join-Path $buildDir 'pages'
$partDir  = Join-Path $buildDir 'partials'

$layout    = Get-Content (Join-Path $buildDir 'layout.html') -Raw -Encoding UTF8
$zoneTable = Get-Content (Join-Path $partDir 'zone-table.html') -Raw -Encoding UTF8

$courierSubnav = @'
<nav class="subnav" aria-label="Courier sections">
  <div class="container subnav-inner">
    <a href="courier.html">Courier hub</a>
    <a href="courier-same-day.html">Same Day</a>
    <a href="courier-rush.html">Rush</a>
    <a href="courier-direct.html">Direct</a>
    <a href="courier-pricing.html">Rates &amp; calculator</a>
    <a href="courier-zones.html">The 10 zones</a>
    <a href="courier-out-of-town.html">Out of town</a>
    <a href="courier-book.html">Book a pickup</a>
  </div>
</nav>
'@

$logisticsSubnav = @'
<nav class="subnav subnav--steel" aria-label="Logistics sections">
  <div class="container subnav-inner">
    <a href="logistics.html">Overview</a>
    <a href="logistics.html#ltl">LTL freight</a>
    <a href="logistics.html#ftl">FTL freight</a>
    <a href="logistics.html#warehousing">Warehousing</a>
    <a href="logistics.html#distribution">Distribution</a>
    <a href="logistics.html#last-mile">Last-mile</a>
    <a href="logistics.html#dedicated">Dedicated fleet</a>
    <a href="logistics-quote.html">Request a quote</a>
  </div>
</nav>
'@

# Title tags and meta descriptions follow Blueprint §11.1 and §11.2.
$pages = @(
  @{ f='index.html';                subnav='';
     t='BF Logistics | Same-Day Courier & Delivery in the GTA';
     d='Same-day courier across 10 GTA zones. Book by 11:30 AM, delivered by 5 PM. Rates from $18. Instant online pricing. Call (905) 500-9443.' }

  @{ f='courier.html';              subnav='courier';
     t='Same-Day Courier Service GTA | BF Logistics';
     d='Same-day, 3-hour rush and 90-minute direct delivery across the GTA. Transparent zone pricing from $18. Get an instant price and book online.' }

  @{ f='courier-same-day.html';     subnav='courier';
     t='Same-Day Delivery GTA - Book by 11:30, There by 5 | BF Logistics';
     d='Book by 11:30 AM and we deliver by 5:00 PM anywhere in the GTA. Rates from $18. Reliable same-day courier from BF Logistics, Brampton.' }

  @{ f='courier-rush.html';         subnav='courier';
     t='3-Hour Rush Courier Service GTA | BF Logistics';
     d='Rush courier across the GTA: three hours from pickup to delivery, rates from $22. The service that runs once the 11:30 AM same-day cutoff has passed.' }

  @{ f='courier-direct.html';       subnav='courier';
     t='90-Minute Direct Delivery GTA | BF Logistics';
     d='Direct courier across the GTA: ninety minutes, point to point, no other stops. Rates from $28. For STAT samples, line-down parts and hard deadlines.' }

  @{ f='courier-pricing.html';      subnav='courier';
     t='Courier Rates GTA - Zone Pricing from $18 | BF Logistics';
     d='See our full GTA courier rate chart. 10 zones, three service levels, no hidden fees. Get an instant price for your delivery in seconds.' }

  @{ f='courier-zones.html';        subnav='courier';
     t='Our 10 GTA Delivery Zones | BF Logistics';
     d='The ten BF Logistics delivery zones across the Greater Toronto Area, mapped and priced. Same Day rates from $18 in Brampton to $46 in Oshawa.' }

  @{ f='courier-out-of-town.html';  subnav='courier';
     t='Out-of-Town Same-Day Delivery from the GTA | BF Logistics';
     d='Same-day delivery from the GTA to Barrie, Guelph, Hamilton, Kitchener, London and beyond. Flat published rates. Call (905) 500-9443.' }

  @{ f='courier-book.html';         subnav='courier';
     t='Book a Pickup | BF Logistics';
     d='Request a same-day, rush or direct pickup across the GTA. See your itemised price as you book, and we will call you back within 30 minutes.' }

  @{ f='logistics.html';            subnav='logistics';
     t='Freight, Warehousing & Distribution GTA | BF Logistics';
     d='LTL and FTL freight, warehousing, distribution and dedicated fleet for GTA businesses. Every load quoted properly. Response within one business day.' }

  @{ f='logistics-quote.html';      subnav='logistics';
     t='Request a Freight Quote | BF Logistics';
     d='Tell us about your freight, warehousing or distribution requirement and we will come back with a real number within one business day.' }

  @{ f='about.html';                subnav='';
     t='About BF Logistics | Brampton Courier & Logistics';
     d='BF Logistics runs same-day courier and freight from Brampton across ten GTA zones, with the whole rate chart published. Here is how we work.' }

  @{ f='faq.html';                  subnav='';
     t='Courier FAQ - Cutoffs, Rates & Coverage | BF Logistics';
     d='Answers on same-day cutoffs, the weight surcharge, zone pricing, coverage and Net 15 accounts. If it is not here, call (905) 500-9443.' }

  @{ f='contact.html';              subnav='';
     t='Contact BF Logistics | Brampton, Ontario';
     d='Call (905) 500-9443 or email admin@bflogistic.ca. BF Logistics, Suite 202-49 Hillcrest Ave, Brampton ON. Monday to Friday, 10:00 AM to 5:00 PM.' }

  @{ f='thank-you.html';            subnav='';
     t='Request Received | BF Logistics';
     d='Your request has been received. A member of the BF Logistics team will call you back within 30 minutes during business hours.' }

  @{ f='404.html';                  subnav='';
     t='Page Not Found | BF Logistics';
     d='That page could not be found. Head back to the homepage, or get an instant price for a same-day GTA delivery.' }
)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$built = 0

foreach ($p in $pages) {
    $fragPath = Join-Path $pagesDir $p.f
    if (-not (Test-Path $fragPath)) { Write-Warning "missing fragment: $($p.f)"; continue }

    $body = Get-Content $fragPath -Raw -Encoding UTF8
    $body = $body.Replace('{{ZONE_TABLE}}', $zoneTable)

    $subnav = ''
    if ($p.subnav -eq 'courier')   { $subnav = $courierSubnav }
    if ($p.subnav -eq 'logistics') { $subnav = $logisticsSubnav }

    $canon = $p.f
    if ($canon -eq 'index.html') { $canon = '' }

    $html = $layout.
        Replace('{{TITLE}}',  $p.t).
        Replace('{{DESC}}',   $p.d).
        Replace('{{CANON}}',  $canon).
        Replace('{{SUBNAV}}', $subnav).
        Replace('{{SCHEMA}}', '').
        Replace('{{BODY}}',   $body)

    [System.IO.File]::WriteAllText((Join-Path $root $p.f), $html, $utf8NoBom)
    $built++
    Write-Host ("  built {0}" -f $p.f)
}

Write-Host ""
Write-Host "$built pages written to $root"
