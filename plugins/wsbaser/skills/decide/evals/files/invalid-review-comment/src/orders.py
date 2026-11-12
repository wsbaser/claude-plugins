"""Shipping for confirmed orders."""


class ShippingError(Exception):
    pass


def ship_order(order, carrier):
    if order is None or order.address is None:
        raise ShippingError("order and its address are required")
    label = carrier.create_label(order.address)
    order.tracking_number = label.tracking_number
    return label
