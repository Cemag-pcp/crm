from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0021_consulta_precos_log'),
    ]

    operations = [
        migrations.AddField(
            model_name='portaluser',
            name='email',
            field=models.EmailField(blank=True, max_length=254),
        ),
    ]
