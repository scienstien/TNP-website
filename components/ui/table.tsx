import type { ComponentProps } from "react";

function classes(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

function Table({ className, ...props }: ComponentProps<"table">) {
  return <table data-slot="table" className={classes("w-full caption-bottom text-sm", className)} {...props} />;
}

function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={className} {...props} />;
}

function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />;
}

function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={className} {...props} />;
}

function TableHead({ className, ...props }: ComponentProps<"th">) {
  return <th data-slot="table-head" className={className} {...props} />;
}

function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td data-slot="table-cell" className={className} {...props} />;
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
