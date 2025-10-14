using DSRSave;

var path = "C:/Users/Iho/Documents/NBGI/DARK SOULS REMASTERED/1269862397/DRAKS0005.sl2";

var save = DSRSaveEditor.ReadSave(path);
save.ToList()[0].Stats.Humanity = 2;
DSRSaveEditor.WriteSave(save, path);