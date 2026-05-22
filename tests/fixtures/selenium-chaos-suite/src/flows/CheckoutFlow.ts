import { LoginPage } from "../pages/LoginPage";
import { ProductsPage } from "../pages/ProductsPage";
import { CartPage } from "../pages/CartPage";
import { CheckoutPage } from "../pages/CheckoutPage";
import { users } from "../data/users";

// Intentionally procedural and repetitive flow class.
export class CheckoutFlow {
  loginPage = new LoginPage();
  productsPage = new ProductsPage();
  cartPage = new CartPage();
  checkoutPage = new CheckoutPage();

  async runHappyPathCheckout() {
    await this.loginPage.loginWith(users.standard.username, users.standard.password);
    await this.productsPage.assertInventoryPageLoaded();
    await this.productsPage.addBackpackToCart();
    await this.productsPage.addBikeLightToCart();
    await this.productsPage.goToCartFromHeader();
    await this.cartPage.assertCartPageLoaded();
    await this.cartPage.goToCheckout();
    await this.checkoutPage.fillCheckoutInfo(users.standard.firstName, users.standard.lastName, users.standard.zip);
    await this.checkoutPage.assertSummaryContainsPayment();
    await this.checkoutPage.assertTotalLooksValid();
    await this.checkoutPage.finishCheckout();
  }

  async runAddRemoveReaddCheckout() {
    await this.loginPage.loginWith(users.standard.username, users.standard.password);
    await this.productsPage.addBackpackToCart();
    await this.productsPage.goToCartFromHeader();
    await this.cartPage.removeFirstItem();
    await this.cartPage.continueShopping();
    await this.productsPage.addAllItemsOneByOne();
    await this.productsPage.goToCartFromHeader();
    await this.cartPage.goToCheckout();
    await this.checkoutPage.fillCheckoutInfo("A", "B", "00000");
    await this.checkoutPage.finishCheckout();
  }
}
