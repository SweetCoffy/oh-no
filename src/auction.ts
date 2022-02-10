import { Collection } from "discord.js";
import { ItemStack } from "./items.js";

export interface AuctionListing {
    seller: string,
    item: ItemStack,
    price: bigint,
}
export type FullAuctionListing = AuctionListing & { id: string, createdAt: number }

export var listings: Collection<string, FullAuctionListing> = new Collection()
export function addListing(listing: AuctionListing): FullAuctionListing {
    var h = Date.now() - 1641197825348
    var id = `${h % 9999}`.padStart(4, "0")
    var full = {
        seller: listing.seller,
        item: listing.item,
        price: listing.price,
        id: id,
        createdAt: Date.now(),
    }
    listings.set(id, full)
    return full;
}