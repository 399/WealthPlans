const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 0,
});

export function formatCurrency(amountInYuan: number) {
  return currencyFormatter.format(amountInYuan);
}
