// The stock "helper" agent answered from Twenty's own documentation, which no
// longer matches this fork (custom finance module, Xero/Wise, Waimin branding),
// so it was removed rather than rebranded. Re-add an entry here to ship a
// standard agent that searches our own handbook instead.
export const STANDARD_AGENT: Record<
  string,
  {
    universalIdentifier: string;
  }
> = {};
