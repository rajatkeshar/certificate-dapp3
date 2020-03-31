var nodemailer=require('node-mailer');

function mailer(to,subject,text)
{
    var smtpTransport = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        auth: {
            user: "jyotsnahere@gmail.com",
            pass: ""
        }
    });
    var mailOptions={
        to : paras.email,
        subject : paras.month+ " "+ paras.year+ " salary certificate",
        text : "Dear "+paras.name,
        html: '<button>Share</button>'
    }
    smtpTransport.sendMail(mailOptions, function(error, res){
    if(error){
        alert("mail not sent");
    }
    else{
        alert("mail sent");
    }
});
}