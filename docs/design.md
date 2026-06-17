# Admin Page Layout

This document defines the reusable admin layout used by the iBadge admin console and attendee management screens.

## Page Shell

- Use a full-page `<main>` with `min-h-screen`, `overflow-hidden`, `bg-[#031225]`, and `text-white`.
- Add one absolute background layer inside the shell:
  - `absolute inset-0`
  - radial cyan glow at the top center
  - deep blue linear gradient from `#031225` to `#020817`
- Place page content in a centered container:
  - `relative z-10`
  - `mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-6`

## Header

- Header uses a single horizontal flex row:
  - left: `ibadge-full.png` logo at `w-[170px]`
  - right: navigation/actions grouped with `flex items-center gap-3`
- Header buttons use the outline glow style:
  - height `h-12`
  - radius `rounded-2xl`
  - border `border-cyan-300/20`
  - background `bg-[#071a33]/70`
  - text `text-white`
  - hover `hover:border-cyan-300/45 hover:bg-cyan-300/10`
- Primary header actions use cyan fill:
  - `bg-cyan-400 text-slate-950`
  - hover `hover:bg-cyan-300`

## Hero Section

- Place a hero section directly below the header.
- Layout:
  - `flex flex-col justify-between gap-5 xl:flex-row xl:items-end`
- Label:
  - small uppercase text
  - `text-xs font-semibold uppercase text-cyan-100/62 tracking-[0.32em]`
- Page title:
  - `mt-3 text-4xl font-semibold tracking-normal text-white md:text-5xl`
- Description:
  - `mt-4 max-w-3xl text-lg leading-8 text-white/72`

## Status Strip

- Use for page-level status, counts, and system state.
- Style:
  - `rounded-[1.35rem] border border-cyan-300/15 bg-[#071a33]/64`
  - `px-6 py-4 text-sm text-white/68`
  - `shadow-[0_0_34px_rgba(25,212,255,0.06)_inset]`
  - responsive row: `md:flex-row md:items-center md:justify-between`
- Left status indicator uses emerald text and a glowing emerald dot.

## Panel Cards

- Use panels for each major content block.
- Style:
  - `rounded-[1.6rem]`
  - `border border-[rgba(64,148,255,0.25)]`
  - `bg-[#071a33]/78`
  - `p-6`
  - `shadow-[0_24px_80px_rgba(0,0,0,0.22),0_0_64px_rgba(25,212,255,0.045)_inset]`
  - `backdrop-blur`
- Panel heading:
  - label: `text-xs font-semibold uppercase text-cyan-100/62 tracking-[0.24em]`
  - title: `mt-2 text-2xl font-semibold tracking-normal text-white`
  - description: `mt-2 text-sm leading-6 text-white/68`

## Forms

- Inputs use the dark admin field style:
  - `h-12 rounded-2xl`
  - `border border-cyan-300/15`
  - `bg-[#031225]/65`
  - `px-4 text-base text-white placeholder:text-white/42`
  - `focus-visible:ring-cyan-300 focus-visible:ring-offset-[#031225]`
- Search fields place a cyan-muted icon at `left-4` and add `pl-11` to the input.
- Upload controls should visually match inputs: same height, radius, border, background, and hover state.

## Tables

- Wrap tables in:
  - `overflow-auto rounded-[1rem] border border-cyan-300/12`
- Table minimum width should preserve readable columns, usually `min-w-[900px]`.
- Header:
  - `bg-[#031225]/70`
  - text `text-xs uppercase tracking-[0.16em] text-white/48`
  - bottom border `border-white/8`
- Rows:
  - `border-b border-white/8 bg-white/[0.025] text-white/76`
  - hover `hover:bg-cyan-300/[0.035]`
  - key identifying cells use `font-semibold text-white`
  - secondary cells use `text-white/68`

## Footer

- Use a low-emphasis operational footer at the bottom of admin pages.
- Style:
  - `grid gap-4 rounded-[1.25rem] border border-cyan-300/12 bg-[#071a33]/70`
  - `px-6 py-4 text-sm text-white/66 md:grid-cols-4`
- First item may use emerald text for current page/system readiness.

## Layout Rules

- Admin pages use a maximum width of `1440px`.
- Use `gap-6` between major sections.
- Use two-column content grids only at wide breakpoints, typically `xl:grid-cols-*`.
- Keep related controls inside the panel they affect.
- Do not use the older `ibadge-shell` and `ibadge-card` classes for new admin pages.
