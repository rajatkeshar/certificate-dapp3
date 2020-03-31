module.exports = {

    insertIntoEmployees: async function() {
        for(var i = 0; i<10; i++){
            app.sdb.create("employee", {
                email: "dummyemail" + i + "@yopmail.com",
                empID: i,
                name: "dummy" + i,
                designation: "dummydesignation" + i,
                bank: "dummybank" + i,
                accountNumber: "dummyaccountnumber" + i,
                pan: "dummypan" + i,
                salary: "" + i,
                walletAddress: "dummyAddress" + i
            })
        }
    },

    saveTransactionId: async function(){
        app.sdb.create('testing', {
            transactionid: this.trs.id
        });
    },

    addressTesting: async function(){
        console.log("The address is: " + this.trs.senderId);
    }
}