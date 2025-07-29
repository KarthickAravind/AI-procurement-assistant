sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("procurement.assistant.controller.Welcome", {
        
        onInit: function () {
            // initialization logic for welcome page
        },

        onGetStarted: function () {
            // Navigate to main page
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteMain");
        }
    });
});
