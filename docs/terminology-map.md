# TrackCOOP Terminology Map

## Confirmed terms

| Use this | Do not use | Applies to |
| --- | --- | --- |
| Product | Item, inventory item | Product records and catalog screens |
| Add Product | Add Item, Add to Inventory | Creating a product record |
| Edit Product | Edit Item, Update Product | Editing product details |
| Save Changes | Update, Confirm Update | Saving edits to an existing record |
| Add Stock | Update Stock, Add Quantity | Increasing product quantity |
| Deduct Stock | Remove Stock, Reduce Item | Decreasing product quantity |
| Archive Product | Delete Product | Hiding a product without permanent deletion |
| Cancel Order | Reject Order | Cancelling an unpaid POS order |
| Cancelled | Rejected | POS order status after cancellation |
| Revoke Payment | Undo Payment | Reversing a validated payment |
| Loading orders... | Loading... | Fetching POS order data |
| Loading activity... | Loading... | Fetching inventory activity |
| Saving changes... | Updating... | Persisting edits |
| Adding product... | Updating stock... | Creating a product |
| Adding stock... | Updating stock... | Increasing stock |
| Deducting stock... | Updating stock... | Decreasing stock |
| Archiving product... | Deleting... | Archiving a product |

## Needs clarification

- Whether a completed POS order may still be revoked.
- Whether membership applications should use `Reject` or `Decline` as the official decision term.
- Whether announcements should be called `Archive` or `Unpublish` when hidden from active listings.
- Whether `Refund` means a completed payment reversal or only a provider-issued refund.

## QA checklist

- [ ] Page headings match the module purpose.
- [ ] Button labels describe the exact backend action.
- [ ] Modal titles and confirmation copy match the button action.
- [ ] Loading labels describe the active request.
- [ ] Success and error toasts use the same action vocabulary.
- [ ] Status values match backend values and database transitions.
- [ ] Product screens do not call products “items” in user-facing copy.
- [ ] Archive actions do not use “Delete” wording when records are preserved.
- [ ] Cancel is used only for stopping an unfinished workflow or cancelling an order.
- [ ] Action state is reset when a new modal opens.
- [ ] Search, empty, retry, and validation messages use consistent nouns and verbs.
- [ ] Terminology is checked for Admin, Chairman, Bookkeeper, Staff, Member, and Guest views.
